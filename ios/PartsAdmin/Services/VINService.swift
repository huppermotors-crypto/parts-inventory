import Foundation

final class VINService {
    static let shared = VINService()

    private let baseURL = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues"

    private init() {}

    func decode(vin: String) async throws -> NHTSAFullDecodeResult {
        guard let url = URL(string: "\(baseURL)/\(vin)?format=json") else {
            throw VINError.invalidVIN
        }

        let (data, _) = try await URLSession.shared.data(from: url)
        let response = try JSONDecoder().decode(NHTSAResponse.self, from: data)

        guard !response.Results.isEmpty else {
            throw VINError.noResults
        }

        let vars = response.Results
        return NHTSAFullDecodeResult(
            year: getInt(vars, "ModelYear"),
            make: getString(vars, "Make"),
            model: getString(vars, "Model"),
            bodyClass: getString(vars, "BodyClass"),
            engineDisplacement: getString(vars, "DisplacementL"),
            engineCylinders: getInt(vars, "EngineCylinders"),
            engineHp: getString(vars, "EngineHP"),
            engineTurbo: getString(vars, "Turbo")?.lowercased().contains("turbo") ?? false,
            driveType: getString(vars, "DriveType"),
            fuelType: getString(vars, "FuelTypePrimary")
        )
    }

    private func getString(_ vars: [NHTSAVariable], _ key: String) -> String? {
        let value = vars.first { $0.Variable == key }?.Value
        if let value, !value.isEmpty, value != "Not Applicable" {
            return value
        }
        return nil
    }

    private func getInt(_ vars: [NHTSAVariable], _ key: String) -> Int? {
        guard let str = getString(vars, key) else { return nil }
        return Int(str)
    }
}

enum VINError: LocalizedError {
    case invalidVIN
    case noResults

    var errorDescription: String? {
        switch self {
        case .invalidVIN: return "Invalid VIN number"
        case .noResults: return "No results found for this VIN"
        }
    }
}
