cask "quicktestz" do
  version :latest
  sha256 :no_check # Updated automatically by CI on each release

  url "https://github.com/Quicklotz/QuickRefurbz/releases/download/v#{version}/QuickTestz-#{version}.dmg"
  name "QuickTestz"
  desc "Desktop app for functional testing and grading of refurbished electronics"
  homepage "https://install.quicktestz.quicklotzwms.com"

  app "QuickTestz.app"

  zap trash: [
    "~/Library/Application Support/QuickTestz",
    "~/Library/Preferences/com.quicklotz.quicktestz.plist",
    "~/Library/Caches/com.quicklotz.quicktestz",
  ]
end
