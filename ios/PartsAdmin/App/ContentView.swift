import SwiftUI

struct ContentView: View {
    @State private var auth = AuthService.shared
    @State private var partsVM = PartsListViewModel()

    var body: some View {
        Group {
            if auth.isLoading {
                ProgressView("Loading...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if auth.isAuthenticated {
                mainTabView
            } else {
                LoginView(auth: auth)
            }
        }
    }

    private var mainTabView: some View {
        TabView {
            DashboardView(vm: partsVM)
                .tabItem {
                    Label("Inventory", systemImage: "shippingbox")
                }

            ListingsView(parts: partsVM.parts)
                .tabItem {
                    Label("Listings", systemImage: "tag")
                }

            AnalyticsView(parts: partsVM.parts)
                .tabItem {
                    Label("Analytics", systemImage: "chart.bar")
                }

            settingsView
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
        }
    }

    private var settingsView: some View {
        NavigationStack {
            List {
                Section("Account") {
                    LabeledContent("Email", value: auth.userEmail ?? "—")

                    Button("Sign Out", role: .destructive) {
                        Task { await auth.signOut() }
                    }
                }

                Section("Info") {
                    LabeledContent("Parts Total", value: "\(partsVM.totalParts)")
                    LabeledContent("Live", value: "\(partsVM.liveParts)")
                    LabeledContent("Sold", value: "\(partsVM.soldParts)")
                }

                Section("About") {
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                    LabeledContent("Build", value: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1")
                }
            }
            .navigationTitle("Settings")
        }
    }
}
