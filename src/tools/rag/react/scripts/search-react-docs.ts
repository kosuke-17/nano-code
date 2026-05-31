import { searchReactDocs } from "..";

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();

  if (!query) {
    console.error('Usage: bun run rag:react:search "React 19 form actions"');
    process.exit(1);
  }

  const results = await searchReactDocs(query, { topK: 5 });

  for (const [index, result] of results.entries()) {
    console.log(`#${index + 1} ${result.title}`);
    console.log(`Score: ${result.score.toFixed(4)}`);
    console.log(`URL: ${result.url}`);
    console.log(result.content.slice(0, 900));
    console.log("---");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
