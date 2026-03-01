import UIKit

enum ImageCompressor {
    static let maxFileSize = 300 * 1024 // 300KB
    static let maxDimension: CGFloat = 1920

    static func compress(_ image: UIImage) -> Data? {
        let resized = resizeIfNeeded(image)

        // Try progressive quality reduction to hit target size
        var quality: CGFloat = 0.8
        while quality > 0.1 {
            if let data = resized.jpegData(compressionQuality: quality),
               data.count <= maxFileSize {
                return data
            }
            quality -= 0.1
        }

        // Last resort: lowest quality
        return resized.jpegData(compressionQuality: 0.1)
    }

    private static func resizeIfNeeded(_ image: UIImage) -> UIImage {
        let size = image.size
        guard size.width > maxDimension || size.height > maxDimension else {
            return image
        }

        let ratio = min(maxDimension / size.width, maxDimension / size.height)
        let newSize = CGSize(width: size.width * ratio, height: size.height * ratio)

        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}
