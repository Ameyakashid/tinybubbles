Pod::Spec.new do |s|
  s.name = 'CloudKitSync'
  s.version = '1.0.0'
  s.summary = 'Tiny Bubbles CloudKit sync Expo module'
  s.description = 'CloudKit sync native module used by Tiny Bubbles on iOS.'
  s.homepage = 'https://github.com/Ameyakashid/tinybubbles'
  s.license = { type: 'AGPL-3.0-only' }
  s.author = { 'Tiny Bubbles' => 'MAINTAINER_EMAIL_PLACEHOLDER' }
  s.platform = :ios, '15.1'
  s.swift_version = '5.0'
  s.source = { git: 'https://github.com/Ameyakashid/tinybubbles.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
