# 開発用静的サーバー(cwd非依存)。 ruby serve.rb で起動。
require 'webrick'

root = File.expand_path(__dir__)
Dir.chdir(root)

server = WEBrick::HTTPServer.new(
  Port: (ARGV[0] || 8123).to_i,
  DocumentRoot: root,
  AccessLog: [],
)
trap('INT') { server.shutdown }
server.start
