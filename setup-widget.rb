require 'xcodeproj'
project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

if project.targets.any? { |t| t.name == 'WidgetExtension' }
  puts "WidgetExtension target already exists. Skipping setup."
  exit 0
end

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
  config.build_settings['PRODUCT_NAME'] = 'WidgetExtension'
  config.build_settings['TARGET_NAME'] = 'WidgetExtension'
  config.build_settings['SWIFT_VERSION'] = '5.0'
end

# Make sure GenericAttributes.swift is also part of the main App target
app_target = project.targets.find { |t| t.name == 'App' }
app_target.add_file_references([generic_attributes_file]) if app_target

if app_target
  # Add dependency so widget builds before app
  app_target.add_dependency(widget_target)

  # Embed the extension into the app
  embed_phase = app_target.copy_files_build_phases.find { |p| p.name == 'Embed Foundation Extensions' }
  unless embed_phase
    embed_phase = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
    embed_phase.name = 'Embed Foundation Extensions'
    embed_phase.symbol_dst_subfolder_spec = :plug_ins
    app_target.build_phases << embed_phase
  end
  # check if not already added
  unless embed_phase.files.map(&:file_ref).include?(widget_target.product_reference)
    build_file = embed_phase.add_file_reference(widget_target.product_reference)
    build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  end
end

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
