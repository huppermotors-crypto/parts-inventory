import SwiftUI
import AVFoundation
import Vision

struct VINScannerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var scannedVIN = ""
    @State private var isScanning = true
    var onScan: (String) -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                CameraPreviewView(onTextRecognized: { texts in
                    guard isScanning else { return }
                    for text in texts {
                        let cleaned = text.replacingOccurrences(of: " ", with: "")
                            .replacingOccurrences(of: "-", with: "")
                            .uppercased()
                        if isValidVIN(cleaned) {
                            isScanning = false
                            scannedVIN = cleaned
                            return
                        }
                    }
                })
                .ignoresSafeArea()

                VStack {
                    Spacer()

                    // Scan guide
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(.yellow, lineWidth: 3)
                        .frame(width: 300, height: 60)
                        .background(.ultraThinMaterial.opacity(0.3))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    Text("Point camera at VIN number")
                        .font(.subheadline)
                        .foregroundStyle(.white)
                        .padding(8)
                        .background(.black.opacity(0.6))
                        .clipShape(Capsule())
                        .padding(.top, 8)

                    Spacer()

                    if !scannedVIN.isEmpty {
                        VStack(spacing: 12) {
                            Text("Scanned VIN:")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(scannedVIN)
                                .font(.title3.monospaced().bold())

                            HStack(spacing: 16) {
                                Button("Rescan") {
                                    scannedVIN = ""
                                    isScanning = true
                                }
                                .buttonStyle(.bordered)

                                Button("Use VIN") {
                                    onScan(scannedVIN)
                                    dismiss()
                                }
                                .buttonStyle(.borderedProminent)
                            }
                        }
                        .padding()
                        .background(.regularMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .padding()
                    }
                }
            }
            .navigationTitle("Scan VIN")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(.white)
                }
            }
        }
    }

    private func isValidVIN(_ vin: String) -> Bool {
        vin.count == 17 && vin.range(of: "^[A-HJ-NPR-Z0-9]{17}$", options: .regularExpression) != nil
    }
}

// MARK: - Camera Preview with Text Recognition

struct CameraPreviewView: UIViewRepresentable {
    let onTextRecognized: ([String]) -> Void

    func makeUIView(context: Context) -> CameraPreviewUIView {
        let view = CameraPreviewUIView()
        view.onTextRecognized = onTextRecognized
        return view
    }

    func updateUIView(_ uiView: CameraPreviewUIView, context: Context) {}
}

class CameraPreviewUIView: UIView {
    var onTextRecognized: (([String]) -> Void)?
    private let session = AVCaptureSession()
    private let output = AVCaptureVideoDataOutput()
    private let queue = DispatchQueue(label: "vin-scanner")

    override func layoutSubviews() {
        super.layoutSubviews()
        setupIfNeeded()
        (layer.sublayers?.first as? AVCaptureVideoPreviewLayer)?.frame = bounds
    }

    private var isSetup = false

    private func setupIfNeeded() {
        guard !isSetup else { return }
        isSetup = true

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device) else { return }

        session.beginConfiguration()
        session.addInput(input)
        output.setSampleBufferDelegate(self, queue: queue)
        session.addOutput(output)
        session.commitConfiguration()

        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = bounds
        layer.insertSublayer(previewLayer, at: 0)

        DispatchQueue.global().async { [weak self] in
            self?.session.startRunning()
        }
    }
}

extension CameraPreviewUIView: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let request = VNRecognizeTextRequest { [weak self] request, _ in
            guard let results = request.results as? [VNRecognizedTextObservation] else { return }
            let texts = results.compactMap { $0.topCandidates(1).first?.string }
            if !texts.isEmpty {
                DispatchQueue.main.async {
                    self?.onTextRecognized?(texts)
                }
            }
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false

        try? VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:]).perform([request])
    }
}

// MARK: - Simple Camera View for Photos

struct CameraView: View {
    @Environment(\.dismiss) private var dismiss
    var onCapture: (UIImage) -> Void

    var body: some View {
        ImagePickerRepresentable(sourceType: .camera) { image in
            onCapture(image)
            dismiss()
        } onCancel: {
            dismiss()
        }
        .ignoresSafeArea()
    }
}

struct ImagePickerRepresentable: UIViewControllerRepresentable {
    let sourceType: UIImagePickerController.SourceType
    let onSelect: (UIImage) -> Void
    let onCancel: () -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelect: onSelect, onCancel: onCancel)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onSelect: (UIImage) -> Void
        let onCancel: () -> Void

        init(onSelect: @escaping (UIImage) -> Void, onCancel: @escaping () -> Void) {
            self.onSelect = onSelect
            self.onCancel = onCancel
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                onSelect(image)
            }
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onCancel()
        }
    }
}
