import { pgTable, uuid, text, integer, timestamp, doublePrecision, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Enums ---
export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'product_admin',
  'support',
  'viewer',
  'owner',
  'child',
  'elder'
]);

export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'suspended']);

export const relationshipTypeEnum = pgEnum('relationship_type', ['parent', 'caregiver', 'other']);

export const productEnum = pgEnum('product_name', ['ptalk_assistant', 'kid_mentor', 'elder_kare']);

export const deviceStatusEnum = pgEnum('device_status', ['online', 'offline', 'error']);

export const sentimentEnum = pgEnum('sentiment_type', ['positive', 'neutral', 'negative']);

// --- Tables ---

// 1. Unified Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  authentikUserId: text('authentik_user_id').unique(), // FK/Ref back to Authentik User ID
  email: text('email').unique().notNull(),
  phone: text('phone'),
  fullName: text('full_name'),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// 2. User Relationships (Account Owner <-> Dependent)
export const userRelationships = pgTable('user_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  dependentId: uuid('dependent_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  relationshipType: relationshipTypeEnum('relationship_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// 3. Product Enrollments (decides which user enrolled in which app)
export const productEnrollments = pgTable('product_enrollments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  productName: productEnum('product_name').notNull(),
  status: text('status').default('active').notNull(),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// 4. Devices (PTalk Robots)
export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  serialNumber: text('serial_number').unique().notNull(),
  firmwareVersion: text('firmware_version').notNull(),
  status: deviceStatusEnum('status').default('offline').notNull(),
  lastSeen: timestamp('last_seen'),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  assignedUserId: uuid('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// 5. Robot Remote Configurations
export const robotConfigurations = pgTable('robot_configurations', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }).unique().notNull(),
  voice: text('voice').default('vi-VN-Standard-A').notNull(),
  language: text('language').default('vi-VN').notNull(),
  personality: text('personality').default('friendly').notNull(),
  volume: integer('volume').default(80).notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// 6. Robot Conversation History
export const robotConversations = pgTable('robot_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  messageContent: text('message_content').notNull(),
  responseContent: text('response_content').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  sentiment: sentimentEnum('sentiment'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// 7. Kid Mentor learning progress
export const learningProgress = pgTable('learning_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),
  lessonsCompleted: integer('lessons_completed').default(0).notNull(),
  averageScore: doublePrecision('average_score').default(0.0).notNull(),
  strongSubjects: jsonb('strong_subjects').$type<string[]>().default([]).notNull(),
  weakSubjects: jsonb('weak_subjects').$type<string[]>().default([]).notNull(),
  timeSpentMinutes: integer('time_spent_minutes').default(0).notNull(),
  lastStudiedAt: timestamp('last_studied_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// 8. Elder Kare Medications list
export const elderMedications = pgTable('elder_medications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  medicineName: text('medicine_name').notNull(),
  dosage: text('dosage').notNull(),
  scheduleTime: text('schedule_time').notNull(), // e.g. "08:00", "20:00"
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// 9. Elder Kare Medication compliance logs
export const medicationLogs = pgTable('medication_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  medicationId: uuid('medication_id').references(() => elderMedications.id, { onDelete: 'cascade' }).notNull(),
  takenAt: timestamp('taken_at'), // null if missed
  status: text('status').default('taken').notNull(), // 'taken', 'missed'
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// 10. Admin Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: text('action').notNull(), // e.g. 'ota_trigger', 'update_user_role'
  targetType: text('target_type').notNull(), // e.g. 'device', 'user'
  targetId: text('target_id').notNull(),
  details: jsonb('details').$type<Record<string, any>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  relationships: many(userRelationships, { relationName: 'owner' }),
  dependents: many(userRelationships, { relationName: 'dependent' }),
  enrollments: many(productEnrollments),
  devicesOwned: many(devices, { relationName: 'owner' }),
  devicesAssigned: many(devices, { relationName: 'assignedUser' }),
  learningProgress: many(learningProgress),
  medications: many(elderMedications),
  auditLogs: many(auditLogs)
}));

export const userRelationshipsRelations = relations(userRelationships, ({ one }) => ({
  owner: one(users, {
    fields: [userRelationships.ownerId],
    references: [users.id],
    relationName: 'owner'
  }),
  dependent: one(users, {
    fields: [userRelationships.dependentId],
    references: [users.id],
    relationName: 'dependent'
  })
}));

export const productEnrollmentsRelations = relations(productEnrollments, ({ one }) => ({
  user: one(users, {
    fields: [productEnrollments.userId],
    references: [users.id]
  })
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  owner: one(users, {
    fields: [devices.ownerId],
    references: [users.id],
    relationName: 'owner'
  }),
  assignedUser: one(users, {
    fields: [devices.assignedUserId],
    references: [users.id],
    relationName: 'assignedUser'
  }),
  configuration: one(robotConfigurations),
  conversations: many(robotConversations)
}));

export const robotConfigurationsRelations = relations(robotConfigurations, ({ one }) => ({
  device: one(devices, {
    fields: [robotConfigurations.deviceId],
    references: [devices.id]
  }),
  operator: one(users, {
    fields: [robotConfigurations.updatedBy],
    references: [users.id]
  })
}));

export const robotConversationsRelations = relations(robotConversations, ({ one }) => ({
  device: one(devices, {
    fields: [robotConversations.deviceId],
    references: [devices.id]
  }),
  user: one(users, {
    fields: [robotConversations.userId],
    references: [users.id]
  })
}));

export const learningProgressRelations = relations(learningProgress, ({ one }) => ({
  user: one(users, {
    fields: [learningProgress.userId],
    references: [users.id]
  })
}));

export const elderMedicationsRelations = relations(elderMedications, ({ one, many }) => ({
  user: one(users, {
    fields: [elderMedications.userId],
    references: [users.id]
  }),
  logs: many(medicationLogs)
}));

export const medicationLogsRelations = relations(medicationLogs, ({ one }) => ({
  medication: one(elderMedications, {
    fields: [medicationLogs.medicationId],
    references: [elderMedications.id]
  })
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
}));
