import ActivityKit
import Foundation

struct GenericAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String
        var subtitle: String
        var period: String
        var percentage: String
        var remaining: String
    }
}
