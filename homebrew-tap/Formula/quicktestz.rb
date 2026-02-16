class Quicktestz < Formula
  desc "QuickTestz CLI - Functional testing and grading for refurbished electronics"
  homepage "https://install.quicktestz.quicklotzwms.com"
  url "https://github.com/Quicklotz/QuickRefurbz/archive/refs/tags/v#{version}.tar.gz"
  sha256 :no_check # Updated automatically by CI on each release
  license "MIT"
  version "1.0.0"

  depends_on "node@20"

  def install
    # Set Node.js path for build
    ENV.prepend_path "PATH", Formula["node@20"].opt_bin

    # Install all dependencies
    system "npm", "ci"

    # Build database package first (dependency for api)
    system "npm", "run", "build", "--workspace=packages/database"

    # Build api package
    system "npm", "run", "build", "--workspace=packages/api"

    # Build the main project
    system "npm", "run", "build"

    # Install production dependencies only into libexec
    libexec.install Dir["*"]
    cd libexec do
      system "npm", "ci", "--omit=dev"
    end

    # Create bin wrappers that invoke node with the correct entry points
    node = Formula["node@20"].opt_bin/"node"

    (bin/"quicktestz").write <<~EOS
      #!/bin/bash
      exec "#{node}" "#{libexec}/dist/cli.js" "$@"
    EOS

    (bin/"qr-enhanced").write <<~EOS
      #!/bin/bash
      exec "#{node}" "#{libexec}/dist/enhanced-cli.js" "$@"
    EOS

    (bin/"qr").write <<~EOS
      #!/bin/bash
      exec "#{node}" "#{libexec}/dist/qr.js" "$@"
    EOS
  end

  test do
    assert_match "QuickTestz", shell_output("#{bin}/quicktestz --help")
  end
end
