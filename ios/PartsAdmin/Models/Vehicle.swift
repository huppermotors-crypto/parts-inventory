import Foundation

struct NHTSAFullDecodeResult: Codable {
    var year: Int?
    var make: String?
    var model: String?
    var bodyClass: String?
    var engineDisplacement: String?
    var engineCylinders: Int?
    var engineHp: String?
    var engineTurbo: Bool
    var driveType: String?
    var fuelType: String?
}

struct NHTSAResponse: Codable {
    let Results: [NHTSAVariable]
}

struct NHTSAVariable: Codable {
    let Variable: String?
    let Value: String?
    let ValueId: String?
    let VariableId: Int?
}
