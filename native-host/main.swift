import Foundation
import ImageIO
import Vision

struct InputMessage: Decodable {
    let imageBase64: String
}

struct TextLine: Encodable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OutputMessage: Encodable {
    let ok: Bool
    let lines: [TextLine]?
    let error: String?
}

func readMessage() throws -> Data? {
    let header = FileHandle.standardInput.readData(ofLength: 4)
    if header.isEmpty { return nil }
    guard header.count == 4 else { throw NSError(domain: "OCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "Mensagem incompleta."]) }

    let length = header.withUnsafeBytes { UInt32(littleEndian: $0.loadUnaligned(as: UInt32.self)) }
    guard length > 0, length <= 64 * 1024 * 1024 else {
        throw NSError(domain: "OCR", code: 2, userInfo: [NSLocalizedDescriptionKey: "Imagem maior que o limite permitido."])
    }
    let body = FileHandle.standardInput.readData(ofLength: Int(length))
    guard body.count == Int(length) else { throw NSError(domain: "OCR", code: 3, userInfo: [NSLocalizedDescriptionKey: "Imagem incompleta."]) }
    return body
}

func writeMessage(_ message: OutputMessage) throws {
    let data = try JSONEncoder().encode(message)
    var length = UInt32(data.count).littleEndian
    FileHandle.standardOutput.write(Data(bytes: &length, count: 4))
    FileHandle.standardOutput.write(data)
}

func orientation(for source: CGImageSource) -> CGImagePropertyOrientation {
    guard
        let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
        let raw = properties[kCGImagePropertyOrientation] as? UInt32,
        let orientation = CGImagePropertyOrientation(rawValue: raw)
    else { return .up }
    return orientation
}

func recognize(_ input: InputMessage) throws -> [TextLine] {
    guard
        let imageData = Data(base64Encoded: input.imageBase64),
        let source = CGImageSourceCreateWithData(imageData as CFData, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        throw NSError(domain: "OCR", code: 4, userInfo: [NSLocalizedDescriptionKey: "Formato de imagem inválido."])
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    if (try? request.supportedRecognitionLanguages().contains("pt-BR")) == true {
        request.recognitionLanguages = ["pt-BR"]
    }

    let handler = VNImageRequestHandler(cgImage: image, orientation: orientation(for: source))
    try handler.perform([request])

    return (request.results ?? []).compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return TextLine(
            text: candidate.string,
            confidence: candidate.confidence,
            x: box.origin.x,
            y: box.origin.y,
            width: box.size.width,
            height: box.size.height
        )
    }
}

do {
    while let data = try readMessage() {
        do {
            let input = try JSONDecoder().decode(InputMessage.self, from: data)
            try writeMessage(OutputMessage(ok: true, lines: try recognize(input), error: nil))
        } catch {
            try writeMessage(OutputMessage(ok: false, lines: nil, error: error.localizedDescription))
        }
    }
} catch {
    try? writeMessage(OutputMessage(ok: false, lines: nil, error: error.localizedDescription))
}
