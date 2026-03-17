require 'xcodeproj'
project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Create a new group for WidgetExtension if doesn't exist
widget_group = project.main_group.find_subpath(File.join('WidgetExtension'), true)
widget_group.set_source_tree('<group>')
widget_group.set_path('WidgetExtension')

# Create a new target
widget_target = project.new_target(:app_extension, 'WidgetExtension', :ios, '16.0')

# Add swift files to the target
generic_attributes_file = widget_group.new_file('GenericAttributes.swift')
widget_extension_file = widget_group.new_file('WidgetExtension.swift')

widget_target.add_file_references([generic_attributes_file, widget_extension_file])

# Update build settings for the widget target
widget_target.build_configurations.each do |config|
  config.build_settings['INFOPLIST_FILE'] = 'WidgetExtension/Info.plist'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.ultimateboi.timetable.WidgetExtension'
  config.build_settings['SWIFT_VERSION'] = '5.0'
end

# Make sure GenericAttributes.swift is also part of the main App target
app_target = project.targets.find { |t| t.name == 'App' }
app_target.add_file_references([generic_attributes_file]) if app_target

# Add NSSupportsLiveActivities to main app Info.plist
info_plist_path = 'ios/App/App/Info.plist'
if File.exist?(info_plist_path)
  content = File.read(info_plist_path)
  unless content.include?('NSSupportsLiveActivities')
    content.sub!('</dict>', "    <key>NSSupportsLiveActivities</key>\n    <true/>\n</dict>")
    File.write(info_plist_path, content)
  end
end

project.save
puts "Successfully configured Xcode project!"
