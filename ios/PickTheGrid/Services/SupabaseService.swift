//
//  SupabaseService.swift
//  PickTheGrid
//
//  Lightweight Supabase REST/GoTrue client using URLSession.
//

import Foundation

struct SupabaseSession: Codable {
    let accessToken: String
    let refreshToken: String
    let userId: String
    let email: String?
    let emailConfirmed: Bool
}

struct SupabaseError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

actor SupabaseService {
    static let shared = SupabaseService()

    let baseURL: String
    let anonKey: String
    var isConfigured: Bool { !baseURL.isEmpty && !anonKey.isEmpty && baseURL.hasPrefix("http") }

    private let session = URLSession(configuration: .default)

    init() {
        baseURL = Config.EXPO_PUBLIC_SUPABASE_URL
        anonKey = Config.EXPO_PUBLIC_SUPABASE_ANON_KEY
    }

    // MARK: - Auth

    func signUp(email: String, password: String, metadata: [String: String]) async throws -> Bool {
        let body: [String: Any] = ["email": email, "password": password, "data": metadata]
        let url = URL(string: "\(baseURL)/auth/v1/signup")!
        let (data, response) = try await post(url, body: body, token: anonKey)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError(message: "No response from server.")
        }
        if !(200...299).contains(http.statusCode) {
            throw SupabaseError(message: parseAuthError(data) ?? "Sign up failed.")
        }
        return true
    }

    func signIn(email: String, password: String) async throws -> SupabaseSession {
        let body: [String: Any] = ["email": email, "password": password]
        let url = URL(string: "\(baseURL)/auth/v1/token?grant_type=password")!
        let (data, response) = try await post(url, body: body, token: anonKey)
        guard let http = response as? HTTPURLResponse else {
            throw SupabaseError(message: "No response from server.")
        }
        if !(200...299).contains(http.statusCode) {
            throw SupabaseError(message: parseAuthError(data) ?? "Invalid email or password.")
        }
        return try parseSession(data)
    }

    func refresh(refreshToken: String) async throws -> SupabaseSession {
        let body: [String: Any] = ["refresh_token": refreshToken]
        let url = URL(string: "\(baseURL)/auth/v1/token?grant_type=refresh_token")!
        let (data, response) = try await post(url, body: body, token: anonKey)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SupabaseError(message: "Session expired.")
        }
        return try parseSession(data)
    }

    func signOut(token: String) async {
        let url = URL(string: "\(baseURL)/auth/v1/logout")!
        _ = try? await post(url, body: [:], token: token, authBearer: token)
    }

    // MARK: - REST (PostgREST)

    /// Generic select returning raw JSON arrays.
    func select(_ table: String, query: String, token: String) async throws -> [[String: Any]] {
        let url = URL(string: "\(baseURL)/rest/v1/\(table)?\(query)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SupabaseError(message: "Failed to load \(table).")
        }
        let json = try JSONSerialization.jsonObject(with: data)
        return (json as? [[String: Any]]) ?? []
    }

    func upsert(_ table: String, rows: [[String: Any]], onConflict: String, token: String) async throws {
        let url = URL(string: "\(baseURL)/rest/v1/\(table)?on_conflict=\(onConflict)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: rows)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? "upsert failed"
            throw SupabaseError(message: msg)
        }
    }

    func insert(_ table: String, row: [String: Any], token: String, returning: Bool = true) async throws -> [[String: Any]] {
        let url = URL(string: "\(baseURL)/rest/v1/\(table)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(returning ? "return=representation" : "return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: row)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? "insert failed"
            throw SupabaseError(message: msg)
        }
        let json = try? JSONSerialization.jsonObject(with: data)
        return (json as? [[String: Any]]) ?? []
    }

    func update(_ table: String, query: String, values: [String: Any], token: String) async throws {
        let url = URL(string: "\(baseURL)/rest/v1/\(table)?\(query)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: values)
        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SupabaseError(message: "update failed")
        }
    }

    func delete(_ table: String, query: String, token: String) async throws {
        let url = URL(string: "\(baseURL)/rest/v1/\(table)?\(query)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SupabaseError(message: "delete failed")
        }
    }

    // MARK: - Helpers

    private func post(_ url: URL, body: [String: Any], token: String, authBearer: String? = nil) async throws -> (Data, URLResponse) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(token, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(authBearer ?? token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await session.data(for: request)
    }

    private func parseSession(_ data: Data) throws -> SupabaseSession {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = json["access_token"] as? String,
              let refreshToken = json["refresh_token"] as? String,
              let user = json["user"] as? [String: Any],
              let userId = user["id"] as? String else {
            throw SupabaseError(message: "Invalid server response.")
        }
        let email = user["email"] as? String
        let confirmed = (user["email_confirmed_at"] as? String) != nil || (user["confirmed_at"] as? String) != nil
        return SupabaseSession(accessToken: accessToken, refreshToken: refreshToken, userId: userId, email: email, emailConfirmed: confirmed)
    }

    private func parseAuthError(_ data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        if let msg = json["msg"] as? String { return msg }
        if let msg = json["error_description"] as? String { return msg }
        if let msg = json["message"] as? String { return msg }
        if let msg = json["error"] as? String { return msg }
        return nil
    }
}
