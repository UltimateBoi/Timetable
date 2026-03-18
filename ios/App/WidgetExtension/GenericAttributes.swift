import ActivityKit
import Foundation

struct GenericAttributes: ActivityAttributes {
    var type: String
    
    public struct ContentState: Codable, Hashable {
        var title: String
        var subtitle: String
        var period: String
        var percentage: String
        var remaining: String
    }
}
