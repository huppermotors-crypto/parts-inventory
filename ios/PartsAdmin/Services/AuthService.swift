import Foundation
import Supabase
import Observation

@Observable
final class AuthService {
    static let shared = AuthService()

    private let client = SupabaseService.shared.client
    private(set) var isAuthenticated = false
    private(set) var isLoading = true
    private(set) var userEmail: String?
    var errorMessage: String?

    private init() {
        Task { await checkSession() }
    }

    func checkSession() async {
        isLoading = true
        do {
            let session = try await client.auth.session
            userEmail = session.user.email
            isAuthenticated = true
        } catch {
            isAuthenticated = false
            userEmail = nil
        }
        isLoading = false
    }

    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let session = try await client.auth.signIn(email: email, password: password)
            userEmail = session.user.email
            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
            isAuthenticated = false
        }
        isLoading = false
    }

    func signOut() async {
        do {
            try await client.auth.signOut()
        } catch {
            // Ignore sign out errors
        }
        isAuthenticated = false
        userEmail = nil
    }
}
