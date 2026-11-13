let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const cmd = JSON.parse(input).tool_input?.command ?? "";
  if (/git\s+push\b.*(--force|\s-f\b)/.test(cmd)) {
    process.stderr.write("Blocked by poc-tools: force push is not allowed\n");
    process.exit(2);
  }
  process.exit(0);
});
