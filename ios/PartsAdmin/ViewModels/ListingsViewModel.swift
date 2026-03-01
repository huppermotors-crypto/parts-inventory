import Foundation
import Observation

@Observable
final class ListingsViewModel {
    var parts: [Part] = []
    var isLoading = false
    var errorMessage: String?
    var filter: ListingPlatform = .all

    enum ListingPlatform: String, CaseIterable {
        case all = "All"
        case facebook = "Facebook"
        case ebay = "eBay"
    }

    var filteredParts: [Part] {
        switch filter {
        case .all:
            return parts.filter { $0.isListedOnFB || $0.isListedOnEbay }
        case .facebook:
            return parts.filter { $0.isListedOnFB }
        case .ebay:
            return parts.filter { $0.isListedOnEbay }
        }
    }

    func loadParts(_ allParts: [Part]) {
        parts = allParts
    }

    func daysListed(_ dateString: String?) -> Int? {
        guard let dateString else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: dateString) else { return nil }
        return Calendar.current.dateComponents([.day], from: date, to: Date()).day
    }

    func delistFromFB(part: Part) async {
        do {
            let updated = try await PartsService.shared.delistFromFB(id: part.id)
            if let idx = parts.firstIndex(where: { $0.id == part.id }) {
                parts[idx] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func delistFromEbay(part: Part) async {
        do {
            let updated = try await PartsService.shared.delistFromEbay(id: part.id)
            if let idx = parts.firstIndex(where: { $0.id == part.id }) {
                parts[idx] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
