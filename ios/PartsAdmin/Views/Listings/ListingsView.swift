import SwiftUI

struct ListingsView: View {
    @State var vm = ListingsViewModel()
    let parts: [Part]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Platform filter
                Picker("Platform", selection: $vm.filter) {
                    ForEach(ListingsViewModel.ListingPlatform.allCases, id: \.self) { platform in
                        Text(platform.rawValue).tag(platform)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                if vm.filteredParts.isEmpty {
                    Spacer()
                    ContentUnavailableView(
                        "No Listings",
                        systemImage: "tag.slash",
                        description: Text("No parts listed on \(vm.filter.rawValue)")
                    )
                    Spacer()
                } else {
                    List(vm.filteredParts) { part in
                        listingRow(part)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Listings")
            .onAppear { vm.loadParts(parts) }
        }
    }

    private func listingRow(_ part: Part) -> some View {
        HStack(spacing: 12) {
            AsyncImage(url: part.firstPhotoURL) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Image(systemName: "photo").foregroundStyle(.gray)
            }
            .frame(width: 50, height: 50)
            .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 4) {
                Text(part.name)
                    .font(.subheadline.bold())
                    .lineLimit(1)

                Text(part.formattedPrice)
                    .font(.caption)

                HStack(spacing: 8) {
                    if part.isListedOnFB {
                        HStack(spacing: 2) {
                            Image(systemName: "f.square.fill")
                                .foregroundStyle(.blue)
                            if let days = vm.daysListed(part.fbPostedAt) {
                                Text("\(days)d")
                            }
                        }
                        .font(.caption2)
                    }

                    if part.isListedOnEbay {
                        HStack(spacing: 2) {
                            Image(systemName: "e.square.fill")
                                .foregroundStyle(.red)
                            if let days = vm.daysListed(part.ebayListedAt) {
                                Text("\(days)d")
                            }
                        }
                        .font(.caption2)
                    }
                }
            }

            Spacer()
        }
        .swipeActions {
            if part.isListedOnFB {
                Button {
                    Task { await vm.delistFromFB(part: part) }
                } label: {
                    Label("Delist FB", systemImage: "f.square")
                }
                .tint(.blue)
            }

            if part.isListedOnEbay {
                Button {
                    Task { await vm.delistFromEbay(part: part) }
                } label: {
                    Label("Delist eBay", systemImage: "e.square")
                }
                .tint(.red)
            }
        }
    }
}
