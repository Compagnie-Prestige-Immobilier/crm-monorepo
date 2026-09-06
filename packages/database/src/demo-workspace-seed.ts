import { DemoWorkspaceFactory, PrismaClient, PrismaPg } from './index.js';

function workspaceUrl(workspace: 'public' | 'demo'): string {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://crm:crm@localhost:5434/crm');
  url.searchParams.set('schema', workspace);
  url.searchParams.set('options', `-csearch_path=${workspace}`);
  return url.toString();
}

const demoDb = new PrismaClient({
  adapter: new PrismaPg({ connectionString: workspaceUrl('demo'), max: 2 }, { schema: 'demo' }),
});

try {
  await new DemoWorkspaceFactory(demoDb).reset();
  console.info('Workspace de démonstration réinitialisé.');
} finally {
  await demoDb.$disconnect();
}
