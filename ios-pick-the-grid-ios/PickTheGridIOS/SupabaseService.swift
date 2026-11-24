//
//  SupabaseService.swift
//  PickTheGridIOS
//
//  Pure-URLSession Supabase client: email auth + PostgREST + RPC.
//  Talks to the SAME live project as the Expo app (expo/lib/supabase.ts),
//  so accounts, predictions, leagues and points are shared cross-platform.
//

import Foundation
import Security

enum SupabaseError: LocalizedError {
    case http(Int, String)
    case notSignedIn
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .http(let code, let message): return message.isEmpty ? "Request failed (\(code))" : message
        case .notSignedIn: return "Not signed in"
        case .decoding(let detail): return "Bad response: \(detail)"
        }
    }
}

struct StoredSession: Codable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var userId: String
    var email: String
}

@MainActor
final class SupabaseService {
    static let shared = SupabaseService()

    // Same public (anon) values the Expo client ships inside its bundle.
    let url: URL
    let anonKey: String

    private(set) var session: StoredSession?

    private let keychainAccount = "supabase-session"

    init() {
        // Config.EXPO_PUBLIC_* values are injected at iOS build time; the
        // literals are the known public fallbacks if injection is absent.
        let urlString = Config.EXPO_PUBLIC_SUPABASE_URL.isEmpty
            ? "https://fxwgbpassouaddakgyus.supabase.co"
            : Config.EXPO_PUBLIC_SUPABASE_URL
        let key = Config.EXPO_PUBLIC_SUPABASE_ANON_KEY.isEmpty
            ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMzc5NDYsImV4cCI6MjA2OTcxNTk0Nn0.n7NNBkr6QXEuYB4VV3IJ_6q_2MTz1DPxJI1vEZGFdY8"
            : Config.EXPO_PUBLIC_SUPABASE_ANON_KEY
        url = URL(string: urlString)!
        anonKey = key
        session = Self.loadSessionFromKeychain()
    }

    var isSignedIn: Bool { session != nil }

    // MARK: - Headers / request building

    private func makeRequest(path: String, method: String, body: Data?, auth: Bool, query: [URLQueryItem] = []) -> URLRequest {
        var components = URLComponents(url: url.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = 20
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(anonKey, forHTTPHeaderField: "X-Client-Info")
        if auth, let session {
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    /// Runs a request, refreshing an expired access token first.
    private func run(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        if let session, session.expiresAt.timeIntervalSinceNow < 60 {
            try await refreshSession()
        }
        let activeRequest = request
        let (data, response) = try await URLSession.shared.data(for: activeRequest)
        let http = response as! HTTPURLResponse
        guard (200..<300).contains(http.statusCode) else {
            throw SupabaseError.http(http.statusCode, Self.errorMessage(from: data))
        }
        return (data, http)
    }

    private static func errorMessage(from data: Data) -> String {
        guard let obj = try? JSONDecoder().decode([String: String].self, from: data),
              let msg = obj["message"] ?? obj["error_description"] ?? obj["error"] else {
            return ""
        }
        return msg
    }

    private static let snakeDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    // MARK: - Auth

    /// Email sign-up. Always returns true: the Expo app enforces email
    /// verification, so any auto-session is discarded and sign-in is blocked
    /// until `email_confirmed_at` is set.
    func signUp(email: String, password: String, data: [String: String]) async throws {
        var payload: [String: Any] = ["email": email, "password": password]
        payload["data"] = data
        let body = try JSONSerialization.data(withJSONObject: payload)
        let request = makeRequest("auth/v1/signup", method: "POST", body: body, auth: false)
        _ = try await run(request)
    }

    func signIn(email: String, password: String) async throws -> SupabaseUser {
        var components = URLComponents(url: url.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])

        let (data, _) = try await run(request)
        let decoded = try Self.snakeDecoder.decode(SupabaseSession.self, from: data)
        saveSession(decoded)
        return decoded.user ?? SupabaseUser(id: "", email: email, emailConfirmedAt: nil, userMetadata: nil)
    }

    func signOut() async {
        if let session {
            let request = makeRequest("auth/v1/logout", method: "POST", body: Data("{}".utf8), auth: true)
            _ = try? await URLSession.shared.data(for: request)
        }
        session = nil
        Self.deleteSessionFromKeychain()
    }

    func refreshSession() async throws {
        guard let session else { throw SupabaseError.notSignedIn }
        var components = URLComponents(url: url.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": session.refreshToken])

        // Raw call — refreshSession is invoked from run(), so it must not
        // route through run() again (infinite recursion).
        let (data, response) = try await URLSession.shared.data(for: request)
        let http = response as! HTTPURLResponse
        guard (200..<300).contains(http.statusCode) else {
            // Refresh rejected: the session is dead, sign out locally.
            self.session = nil
            Self.deleteSessionFromKeychain()
            throw SupabaseError.http(http.statusCode, Self.errorMessage(from: data))
        }
        let decoded = try Self.snakeDecoder.decode(SupabaseSession.self, from: data)
        saveSession(decoded)
    }

    private func saveSession(_ decoded: SupabaseSession) {
        let stored = StoredSession(
            accessToken: decoded.accessToken,
            refreshToken: decoded.refreshToken,
            expiresAt: Date().addingTimeInterval(TimeInterval(decoded.expiresIn)),
            userId: decoded.user?.id ?? "",
            email: decoded.user?.email ?? ""
        )
        self.session = stored
        Self.saveSessionToKeychain(stored)
    }

    // MARK: - Keychain persistence

    private static func saveSessionToKeychain(_ session: StoredSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "supabase-session",
            kSecAttrService as String: "app.rork.pickthegrid",
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        SecItemAdd(add as CFDictionary, nil)
    }

    private static func loadSessionFromKeychain() -> StoredSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "supabase-session",
            kSecAttrService as String: "app.rork.pickthegrid",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let session = try? JSONDecoder().decode(StoredSession.self, from: data) else { return nil }
        return session
    }

    private static func deleteSessionFromKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "supabase-session",
            kSecAttrService as String: "app.rork.pickthegrid",
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - PostgREST

    func select<T: Decodable>(_ table: String, query: [String: String] = [], limit: Int? = nil) async throws -> [T] {
        var items = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        if let limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }
        let request = makeRequest("rest/v1/\(table)", method: "GET", body: nil, auth: true, query: items)
        let (data, _) = try await run(request)
        do {
            return try Self.snakeDecoder.decode([T].self, from: data)
        } catch {
            throw SupabaseError.decoding(String(describing: error))
        }
    }

    func insert<T: Decodable>(_ table: String, body: [String: Any], returning: Bool = true) async throws -> [T] {
        var request = makeRequest("rest/v1/\(table)", method: "POST", body: try JSONSerialization.data(withJSONObject: body), auth: true)
        if returning { request.setValue("return=representation", forHTTPHeaderField: "Prefer") }
        let (data, _) = try await run(request)
        return returning ? (try? Self.snakeDecoder.decode([T].self, from: data)) ?? [] : []
    }

    func upsert(_ table: String, body: [String: Any], onConflict: String? = nil) async throws {
        var query: [URLQueryItem] = []
        if let onConflict { query.append(URLQueryItem(name: "on_conflict", value: onConflict)) }
        var request = makeRequest("rest/v1/\(table)", method: "POST", body: try JSONSerialization.data(withJSONObject: body), auth: true, query: query)
        request.setValue("return=minimal,resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        _ = try await run(request)
    }

    func update(_ table: String, query: [String: String], body: [String: Any]) async throws {
        let items = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        let request = makeRequest("rest/v1/\(table)", method: "PATCH", body: try JSONSerialization.data(withJSONObject: body), auth: true, query: items)
        _ = try await run(request)
    }

    func rpc(_ function: String, body: [String: Any]) async throws {
        let request = makeRequest("rest/v1/rpc/\(function)", method: "POST", body: try JSONSerialization.data(withJSONObject: body), auth: true)
        _ = try await run(request)
    }
}
