// seeders/index.ts
// Central registry for all seeders
// DatabaseManager imports this to run tracked seeders

import { initialize as knowledgeBaseSeeder } from './KnowledgeBaseSeeder';  // adjust path if needed

// Add future seeders here in the same way
// import { initialize as someOtherSeeder } from './some-other-seeder';

export const seedersRegistry = [
  {
    name: 'knowledgebase-seeder',
    run: knowledgeBaseSeeder,
  },
  // {
  //   name: 'users-initial-seed',
  //   run: usersSeeder,
  // },
  // {
  //   name: 'core-data-seed',
  //   run: coreDataSeeder,
  // },
] as const;