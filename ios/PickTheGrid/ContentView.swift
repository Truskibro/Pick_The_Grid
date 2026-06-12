//
//  ContentView.swift
//  PickTheGrid
//
//  Created by Rork on June 12, 2026.
//

import SwiftUI

/// Placeholder shown until Rork replaces it with the real app UI.
/// This view is intentionally minimal: it must never ship as a final screen.
struct ContentView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .controlSize(.large)
            Text("Rork is building your app…")
                .font(.headline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}

#Preview {
    ContentView()
}
