import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBranchManagementRepairPlan } from '../src/lib/db/schemaRepair';

test('branch schema repair adds missing branch management tables, columns, and indexes', () => {
  const steps = buildBranchManagementRepairPlan({
    tables: ['users', 'branch_allowed_ips'],
    columns: {
      users: ['id', 'email', 'branch'],
      branch_allowed_ips: ['id', 'branch_name'],
    },
    indexes: {
      users: ['idx_users_role', 'idx_users_branch'],
      branch_allowed_ips: ['idx_branch_allowed_ips_branch'],
    },
  });

  assert.deepEqual(
    steps.map((step) => step.name),
    [
      'create_branches_table',
      'add_users_branch_id',
      'add_branch_allowed_ips_branch_id',
      'add_branch_allowed_ips_rule_type',
      'add_branch_allowed_ips_created_by',
      'add_branch_allowed_ips_updated_at',
      'seed_default_branches',
      'backfill_branches_from_existing_names',
      'backfill_user_branch_ids',
      'backfill_branch_ip_branch_ids',
      'create_idx_branches_active',
      'create_idx_users_branch_id',
      'create_idx_branch_allowed_ips_branch_id',
      'create_idx_branch_allowed_ips_active',
      'create_idx_branch_allowed_ips_rule_type',
    ]
  );
});

test('branch schema repair restores missing branch IP rule columns from older databases', () => {
  const steps = buildBranchManagementRepairPlan({
    tables: ['users', 'branch_allowed_ips', 'branches'],
    columns: {
      users: ['id', 'email', 'branch', 'branch_id'],
      branch_allowed_ips: ['id', 'branch_name', 'branch_id', 'ip_network', 'description', 'is_active', 'created_at'],
      branches: ['id', 'name', 'code', 'address', 'is_active', 'created_at', 'updated_at'],
    },
    indexes: {
      users: ['idx_users_role', 'idx_users_branch', 'idx_users_branch_id'],
      branch_allowed_ips: ['idx_branch_allowed_ips_network', 'idx_branch_allowed_ips_branch_id'],
      branches: ['uk_branches_name', 'uk_branches_code', 'idx_branches_active'],
    },
  });

  assert.deepEqual(
    steps.map((step) => step.name).filter((name) => name.includes('branch_allowed_ips')),
    [
      'add_branch_allowed_ips_rule_type',
      'add_branch_allowed_ips_created_by',
      'add_branch_allowed_ips_updated_at',
      'create_idx_branch_allowed_ips_branch',
      'create_idx_branch_allowed_ips_active',
      'create_idx_branch_allowed_ips_rule_type',
    ]
  );
});

test('branch schema repair does not add duplicate schema objects that already exist', () => {
  const steps = buildBranchManagementRepairPlan({
    tables: ['users', 'branch_allowed_ips', 'branches'],
    columns: {
      users: ['id', 'email', 'branch', 'branch_id'],
      branch_allowed_ips: [
        'id',
        'branch_name',
        'branch_id',
        'rule_type',
        'ip_network',
        'description',
        'is_active',
        'created_by',
        'created_at',
        'updated_at',
      ],
      branches: ['id', 'name', 'code', 'address', 'is_active', 'created_at', 'updated_at'],
    },
    indexes: {
      users: ['idx_users_role', 'idx_users_branch', 'idx_users_branch_id'],
      branch_allowed_ips: [
        'idx_branch_allowed_ips_branch',
        'idx_branch_allowed_ips_branch_id',
        'idx_branch_allowed_ips_active',
        'idx_branch_allowed_ips_rule_type',
      ],
      branches: ['uk_branches_name', 'uk_branches_code', 'idx_branches_active'],
    },
  });

  assert.deepEqual(
    steps.map((step) => step.name),
    [
      'seed_default_branches',
      'backfill_branches_from_existing_names',
      'backfill_user_branch_ids',
      'backfill_branch_ip_branch_ids',
    ]
  );
});
