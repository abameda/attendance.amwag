import { BRANCHES } from '@/lib/branches';
import { buildBranchCode } from '@/lib/branchDirectory';

export type SchemaSnapshot = {
  tables: string[];
  columns: Record<string, string[]>;
  indexes: Record<string, string[]>;
};

type SchemaRepairSqlParameter = string | number | bigint | boolean | Date | null | Buffer | Uint8Array;

export type SchemaRepairStep = {
  name: string;
  sql: string;
  params?: SchemaRepairSqlParameter[];
};

type Queryable = {
  query(sql: string, params?: SchemaRepairSqlParameter[]): Promise<[unknown, unknown]>;
};

function hasTable(snapshot: SchemaSnapshot, table: string) {
  return snapshot.tables.includes(table);
}

function hasColumn(snapshot: SchemaSnapshot, table: string, column: string) {
  return (snapshot.columns[table] ?? []).includes(column);
}

function hasIndex(snapshot: SchemaSnapshot, table: string, index: string) {
  return (snapshot.indexes[table] ?? []).includes(index);
}

function defaultBranchSeedStep(defaultBranchNames: readonly string[]): SchemaRepairStep {
  const valuesSql = defaultBranchNames.map(() => '(UUID(), ?, ?)').join(', ');
  const params = defaultBranchNames.flatMap((name) => [name, buildBranchCode(name)]);

  return {
    name: 'seed_default_branches',
    sql: `INSERT IGNORE INTO \`branches\` (\`id\`, \`name\`, \`code\`) VALUES ${valuesSql}`,
    params,
  };
}

export function buildBranchManagementRepairPlan(
  snapshot: SchemaSnapshot,
  defaultBranchNames: readonly string[] = BRANCHES
): SchemaRepairStep[] {
  const steps: SchemaRepairStep[] = [];
  const branchesExists = hasTable(snapshot, 'branches');

  if (!branchesExists) {
    steps.push({
      name: 'create_branches_table',
      sql: `CREATE TABLE \`branches\` (
  \`id\` char(36) NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`code\` varchar(64) NOT NULL,
  \`address\` text,
  \`is_active\` tinyint NOT NULL DEFAULT 1,
  \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT \`branches_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`uk_branches_name\` UNIQUE(\`name\`),
  CONSTRAINT \`uk_branches_code\` UNIQUE(\`code\`)
)`,
    });
  } else {
    if (!hasColumn(snapshot, 'branches', 'address')) {
      steps.push({
        name: 'add_branches_address',
        sql: 'ALTER TABLE `branches` ADD COLUMN `address` text AFTER `code`',
      });
    }

    if (!hasColumn(snapshot, 'branches', 'is_active')) {
      steps.push({
        name: 'add_branches_is_active',
        sql: 'ALTER TABLE `branches` ADD COLUMN `is_active` tinyint NOT NULL DEFAULT 1 AFTER `address`',
      });
    }

    if (!hasColumn(snapshot, 'branches', 'created_at')) {
      steps.push({
        name: 'add_branches_created_at',
        sql:
          'ALTER TABLE `branches` ADD COLUMN `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `is_active`',
      });
    }

    if (!hasColumn(snapshot, 'branches', 'updated_at')) {
      steps.push({
        name: 'add_branches_updated_at',
        sql:
          'ALTER TABLE `branches` ADD COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `created_at`',
      });
    }

    if (!hasIndex(snapshot, 'branches', 'uk_branches_name')) {
      steps.push({
        name: 'create_uk_branches_name',
        sql: 'CREATE UNIQUE INDEX `uk_branches_name` ON `branches` (`name`)',
      });
    }

    if (!hasIndex(snapshot, 'branches', 'uk_branches_code')) {
      steps.push({
        name: 'create_uk_branches_code',
        sql: 'CREATE UNIQUE INDEX `uk_branches_code` ON `branches` (`code`)',
      });
    }
  }

  if (!hasColumn(snapshot, 'users', 'branch_id')) {
    steps.push({
      name: 'add_users_branch_id',
      sql: 'ALTER TABLE `users` ADD COLUMN `branch_id` char(36) AFTER `branch`',
    });
  }

  if (!hasColumn(snapshot, 'branch_allowed_ips', 'branch_id')) {
    steps.push({
      name: 'add_branch_allowed_ips_branch_id',
      sql: 'ALTER TABLE `branch_allowed_ips` ADD COLUMN `branch_id` char(36) AFTER `branch_name`',
    });
  }

  if (!hasColumn(snapshot, 'branch_allowed_ips', 'rule_type')) {
    steps.push({
      name: 'add_branch_allowed_ips_rule_type',
      sql:
        "ALTER TABLE `branch_allowed_ips` ADD COLUMN `rule_type` enum('exact_ip','cidr') NOT NULL DEFAULT 'exact_ip' AFTER `branch_id`",
    });
  }

  if (!hasColumn(snapshot, 'branch_allowed_ips', 'created_by')) {
    steps.push({
      name: 'add_branch_allowed_ips_created_by',
      sql: 'ALTER TABLE `branch_allowed_ips` ADD COLUMN `created_by` char(36) AFTER `is_active`',
    });
  }

  if (!hasColumn(snapshot, 'branch_allowed_ips', 'updated_at')) {
    steps.push({
      name: 'add_branch_allowed_ips_updated_at',
      sql:
        'ALTER TABLE `branch_allowed_ips` ADD COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `created_at`',
    });
  }

  steps.push(defaultBranchSeedStep(defaultBranchNames));
  steps.push({
    name: 'backfill_branches_from_existing_names',
    sql: `INSERT IGNORE INTO \`branches\` (\`id\`, \`name\`, \`code\`)
SELECT UUID(), source.\`branch_name\`, CONCAT('BR-', SUBSTRING(SHA2(source.\`branch_name\`, 256), 1, 12))
FROM (
  SELECT DISTINCT TRIM(\`branch\`) AS \`branch_name\` FROM \`users\` WHERE \`branch\` IS NOT NULL AND TRIM(\`branch\`) <> ''
  UNION
  SELECT DISTINCT TRIM(\`branch_name\`) AS \`branch_name\` FROM \`branch_allowed_ips\` WHERE \`branch_name\` IS NOT NULL AND TRIM(\`branch_name\`) <> ''
) source`,
  });
  steps.push({
    name: 'backfill_user_branch_ids',
    sql: `UPDATE \`users\` user_rows
JOIN \`branches\` branch_rows ON branch_rows.\`name\` = TRIM(user_rows.\`branch\`)
SET user_rows.\`branch_id\` = branch_rows.\`id\`
WHERE user_rows.\`branch\` IS NOT NULL
  AND TRIM(user_rows.\`branch\`) <> ''
  AND user_rows.\`branch_id\` IS NULL`,
  });
  steps.push({
    name: 'backfill_branch_ip_branch_ids',
    sql: `UPDATE \`branch_allowed_ips\` ip_rows
JOIN \`branches\` branch_rows ON branch_rows.\`name\` = TRIM(ip_rows.\`branch_name\`)
SET ip_rows.\`branch_id\` = branch_rows.\`id\`
WHERE ip_rows.\`branch_name\` IS NOT NULL
  AND TRIM(ip_rows.\`branch_name\`) <> ''
  AND ip_rows.\`branch_id\` IS NULL`,
  });

  if (!hasIndex(snapshot, 'branches', 'idx_branches_active')) {
    steps.push({
      name: 'create_idx_branches_active',
      sql: 'CREATE INDEX `idx_branches_active` ON `branches` (`is_active`)',
    });
  }

  if (!hasIndex(snapshot, 'users', 'idx_users_branch_id')) {
    steps.push({
      name: 'create_idx_users_branch_id',
      sql: 'CREATE INDEX `idx_users_branch_id` ON `users` (`branch_id`)',
    });
  }

  if (!hasIndex(snapshot, 'branch_allowed_ips', 'idx_branch_allowed_ips_branch')) {
    steps.push({
      name: 'create_idx_branch_allowed_ips_branch',
      sql: 'CREATE INDEX `idx_branch_allowed_ips_branch` ON `branch_allowed_ips` (`branch_name`)',
    });
  }

  if (!hasIndex(snapshot, 'branch_allowed_ips', 'idx_branch_allowed_ips_branch_id')) {
    steps.push({
      name: 'create_idx_branch_allowed_ips_branch_id',
      sql: 'CREATE INDEX `idx_branch_allowed_ips_branch_id` ON `branch_allowed_ips` (`branch_id`)',
    });
  }

  if (!hasIndex(snapshot, 'branch_allowed_ips', 'idx_branch_allowed_ips_active')) {
    steps.push({
      name: 'create_idx_branch_allowed_ips_active',
      sql: 'CREATE INDEX `idx_branch_allowed_ips_active` ON `branch_allowed_ips` (`is_active`)',
    });
  }

  if (!hasIndex(snapshot, 'branch_allowed_ips', 'idx_branch_allowed_ips_rule_type')) {
    steps.push({
      name: 'create_idx_branch_allowed_ips_rule_type',
      sql: 'CREATE INDEX `idx_branch_allowed_ips_rule_type` ON `branch_allowed_ips` (`rule_type`)',
    });
  }

  return steps;
}

export async function readSchemaSnapshot(
  connection: Queryable,
  databaseName: string,
  tableNames: string[]
): Promise<SchemaSnapshot> {
  const [tableRowsResult] = await connection.query(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${tableNames.map(() => '?').join(', ')})`,
    [databaseName, ...tableNames]
  );
  const [columnRowsResult] = await connection.query(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${tableNames.map(() => '?').join(', ')})`,
    [databaseName, ...tableNames]
  );
  const [indexRowsResult] = await connection.query(
    `SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${tableNames.map(() => '?').join(', ')})`,
    [databaseName, ...tableNames]
  );

  const columns: Record<string, string[]> = {};
  const indexes: Record<string, string[]> = {};
  const tableRows = tableRowsResult as Array<{ tableName: string }>;
  const columnRows = columnRowsResult as Array<{ tableName: string; columnName: string }>;
  const indexRows = indexRowsResult as Array<{ tableName: string; indexName: string }>;

  for (const row of columnRows) {
    columns[row.tableName] ??= [];
    columns[row.tableName].push(row.columnName);
  }

  for (const row of indexRows) {
    indexes[row.tableName] ??= [];
    indexes[row.tableName].push(row.indexName);
  }

  return {
    tables: tableRows.map((row) => row.tableName),
    columns,
    indexes,
  };
}
