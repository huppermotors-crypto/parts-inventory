import Foundation
import UIKit
import Supabase

final class StorageService {
    static let shared = StorageService()

    private let client = SupabaseService.shared.client
    private let bucket = "part-photos"

    private init() {}

    func uploadPhoto(_ image: UIImage) async throws -> String {
        guard let data = ImageCompressor.compress(image) else {
            throw StorageError.compressionFailed
        }

        let timestamp = Int(Date().timeIntervalSince1970 * 1000)
        let random = Int.random(in: 1000...9999)
        let filename = "parts/\(timestamp)-\(random).jpg"

        try await client.storage
            .from(bucket)
            .upload(
                filename,
                data: data,
                options: FileOptions(
                    cacheControl: "3600",
                    contentType: "image/jpeg"
                )
            )

        let publicURL = try client.storage
            .from(bucket)
            .getPublicURL(path: filename)

        return publicURL.absoluteString
    }

    func deletePhoto(url: String) async throws {
        guard let path = extractPath(from: url) else { return }
        try await client.storage
            .from(bucket)
            .remove(paths: [path])
    }

    func deletePhotos(urls: [String]) async throws {
        let paths = urls.compactMap { extractPath(from: $0) }
        guard !paths.isEmpty else { return }
        try await client.storage
            .from(bucket)
            .remove(paths: paths)
    }

    private func extractPath(from url: String) -> String? {
        // URL format: .../storage/v1/object/public/part-photos/parts/filename.jpg
        guard let range = url.range(of: "part-photos/") else { return nil }
        return String(url[range.upperBound...])
    }
}

enum StorageError: LocalizedError {
    case compressionFailed

    var errorDescription: String? {
        switch self {
        case .compressionFailed:
            return "Failed to compress image"
        }
    }
}
