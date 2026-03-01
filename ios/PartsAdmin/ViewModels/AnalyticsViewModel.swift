import Foundation
import Observation

@Observable
final class AnalyticsViewModel {
    var parts: [Part] = []

    var soldParts: [Part] { parts.filter { $0.isSold } }
    var liveParts: [Part] { parts.filter { !$0.isSold } }

    var totalRevenue: Double {
        soldParts.reduce(0) { $0 + ($1.soldPrice ?? $1.lotPrice) }
    }

    var averageSalePrice: Double {
        guard !soldParts.isEmpty else { return 0 }
        return totalRevenue / Double(soldParts.count)
    }

    var totalInventoryValue: Double {
        liveParts.reduce(0) { $0 + $1.lotPrice }
    }

    var totalParts: Int { parts.count }
    var soldCount: Int { soldParts.count }
    var liveCount: Int { liveParts.count }

    struct CategoryStat: Identifiable {
        let id = UUID()
        let category: String
        let label: String
        let count: Int
        let revenue: Double
    }

    var categoryStats: [CategoryStat] {
        let grouped = Dictionary(grouping: soldParts, by: \.category)
        return grouped.map { key, parts in
            CategoryStat(
                category: key,
                label: Constants.categoryLabel(for: key),
                count: parts.count,
                revenue: parts.reduce(0) { $0 + ($1.soldPrice ?? $1.lotPrice) }
            )
        }
        .sorted { $0.revenue > $1.revenue }
    }

    struct MonthlyStat: Identifiable {
        let id = UUID()
        let month: Date
        let count: Int
        let revenue: Double
    }

    var monthlyStats: [MonthlyStat] {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let calendar = Calendar.current
        let grouped = Dictionary(grouping: soldParts) { part -> Date? in
            guard let dateStr = part.soldAt, let date = formatter.date(from: dateStr) else { return nil }
            return calendar.date(from: calendar.dateComponents([.year, .month], from: date))
        }

        return grouped.compactMap { date, parts in
            guard let date else { return nil }
            return MonthlyStat(
                month: date,
                count: parts.count,
                revenue: parts.reduce(0) { $0 + ($1.soldPrice ?? $1.lotPrice) }
            )
        }
        .sorted { $0.month < $1.month }
    }

    func loadParts(_ allParts: [Part]) {
        parts = allParts
    }
}
