import Foundation
import Observation

enum StatusFilter: String, CaseIterable {
    case all = "All"
    case live = "Live"
    case sold = "Sold"
}

enum SortField: String, CaseIterable {
    case createdAt = "Date"
    case name = "Name"
    case price = "Price"
    case make = "Make"
    case category = "Category"
}

@Observable
final class PartsListViewModel {
    var parts: [Part] = []
    var isLoading = false
    var errorMessage: String?
    var searchText = ""

    // Filters
    var statusFilter: StatusFilter = .all
    var makeFilter: String?
    var categoryFilter: String?

    // Sort
    var sortField: SortField = .createdAt
    var sortAscending = false

    // Bulk selection
    var selectedIds: Set<String> = []
    var isSelecting = false

    // Stats
    var totalParts: Int { parts.count }
    var liveParts: Int { parts.filter { !$0.isSold }.count }
    var soldParts: Int { parts.filter { $0.isSold }.count }
    var totalValue: Double { parts.filter { !$0.isSold }.reduce(0) { $0 + $1.lotPrice } }

    var availableMakes: [String] {
        Array(Set(parts.compactMap { $0.make })).sorted()
    }

    var filteredParts: [Part] {
        var result = parts

        // Status filter
        switch statusFilter {
        case .all: break
        case .live: result = result.filter { !$0.isSold }
        case .sold: result = result.filter { $0.isSold }
        }

        // Make filter
        if let make = makeFilter {
            result = result.filter { $0.make?.lowercased() == make.lowercased() }
        }

        // Category filter
        if let category = categoryFilter {
            result = result.filter { $0.category == category }
        }

        // Search
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter {
                $0.name.lowercased().contains(query) ||
                ($0.stockNumber?.lowercased().contains(query) ?? false) ||
                ($0.make?.lowercased().contains(query) ?? false) ||
                ($0.model?.lowercased().contains(query) ?? false) ||
                ($0.vin?.lowercased().contains(query) ?? false)
            }
        }

        return result.sorted { a, b in
            let comparison: Bool
            switch sortField {
            case .createdAt:
                comparison = a.createdAt < b.createdAt
            case .name:
                comparison = a.name.lowercased() < b.name.lowercased()
            case .price:
                comparison = a.price < b.price
            case .make:
                comparison = (a.make ?? "") < (b.make ?? "")
            case .category:
                comparison = a.category < b.category
            }
            return sortAscending ? comparison : !comparison
        }
    }

    func loadParts() async {
        isLoading = true
        errorMessage = nil
        do {
            parts = try await PartsService.shared.fetchAll()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func deletePart(_ part: Part) async {
        do {
            if !part.photos.isEmpty {
                try await StorageService.shared.deletePhotos(urls: part.photos)
            }
            try await PartsService.shared.delete(id: part.id)
            parts.removeAll { $0.id == part.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sellPart(_ part: Part, price: Double) async {
        do {
            let updated = try await PartsService.shared.sellPart(id: part.id, soldPrice: price)
            if let idx = parts.firstIndex(where: { $0.id == part.id }) {
                parts[idx] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func unsellPart(_ part: Part) async {
        do {
            let updated = try await PartsService.shared.unsellPart(id: part.id)
            if let idx = parts.firstIndex(where: { $0.id == part.id }) {
                parts[idx] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Bulk

    func toggleSelection(_ id: String) {
        if selectedIds.contains(id) {
            selectedIds.remove(id)
        } else {
            selectedIds.insert(id)
        }
    }

    func selectAll() {
        selectedIds = Set(filteredParts.map(\.id))
    }

    func clearSelection() {
        selectedIds.removeAll()
        isSelecting = false
    }

    func bulkDelete() async {
        do {
            try await PartsService.shared.bulkDelete(ids: Array(selectedIds))
            parts.removeAll { selectedIds.contains($0.id) }
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func bulkMarkSold() async {
        do {
            try await PartsService.shared.bulkMarkSold(ids: Array(selectedIds))
            await loadParts()
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func bulkMarkAvailable() async {
        do {
            try await PartsService.shared.bulkMarkAvailable(ids: Array(selectedIds))
            await loadParts()
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updatePartInList(_ part: Part) {
        if let idx = parts.firstIndex(where: { $0.id == part.id }) {
            parts[idx] = part
        }
    }
}
