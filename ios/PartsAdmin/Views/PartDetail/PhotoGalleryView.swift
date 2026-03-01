import SwiftUI

struct PhotoGalleryView: View {
    let photoURLs: [String]
    @State private var selectedIndex = 0

    var body: some View {
        VStack(spacing: 8) {
            // Main photo
            TabView(selection: $selectedIndex) {
                ForEach(Array(photoURLs.enumerated()), id: \.offset) { index, url in
                    AsyncImage(url: URL(string: url)) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                        case .failure:
                            Image(systemName: "photo.badge.exclamationmark")
                                .font(.largeTitle)
                                .foregroundStyle(.gray)
                        case .empty:
                            ProgressView()
                        @unknown default:
                            EmptyView()
                        }
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .automatic))
            .frame(height: 300)
            .background(Color(.systemGray6))

            // Thumbnail strip
            if photoURLs.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Array(photoURLs.enumerated()), id: \.offset) { index, url in
                            AsyncImage(url: URL(string: url)) { image in
                                image.resizable().aspectRatio(contentMode: .fill)
                            } placeholder: {
                                Color(.systemGray5)
                            }
                            .frame(width: 50, height: 50)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(index == selectedIndex ? Color.blue : Color.clear, lineWidth: 2)
                            )
                            .onTapGesture {
                                withAnimation { selectedIndex = index }
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }

            // Counter
            Text("\(selectedIndex + 1) / \(photoURLs.count)")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}
