import { db } from './connection';
import {
  users,
  userRelationships,
  productEnrollments,
  devices,
  robotConfigurations,
  robotConversations,
  learningProgress,
  elderMedications,
  medicationLogs,
  auditLogs
} from './schema';

async function seed() {
  console.log('Seeding ptalk_business database with mock data...');

  try {
    // Clear existing records in correct order to ensure seed idempotency and avoid unique constraint violations

    console.log('Clearing existing records to ensure seed idempotency...');
    await db.delete(medicationLogs);
    await db.delete(elderMedications);
    await db.delete(robotConversations);
    await db.delete(robotConfigurations);
    await db.delete(devices);
    await db.delete(productEnrollments);
    await db.delete(userRelationships);
    await db.delete(learningProgress);
    await db.delete(auditLogs);
    await db.delete(users);

    // 1. Seed Users (Dashboard Users & End Users)
    console.log('Seeding users...');
    const insertedUsers = await db.insert(users).values([

      // Operational Admins
      {
        authentikUserId: 'a1111111-1111-1111-1111-111111111111',
        email: 'superadmin@ptalk.vn',
        fullName: 'Nguyễn Văn Admin',
        phone: '0901234567',
        role: 'super_admin',
        status: 'active'
      },
      {
        authentikUserId: 'a2222222-2222-2222-2222-222222222222',
        email: 'productadmin@ptalk.vn',
        fullName: 'Trần Thị Product',
        phone: '0907654321',
        role: 'product_admin',
        status: 'active'
      },
      {
        authentikUserId: 'a3333333-3333-3333-3333-333333333333',
        email: 'support@ptalk.vn',
        fullName: 'Lê Văn Support',
        phone: '0911223344',
        role: 'support',
        status: 'active'
      },
      // Account Owner
      {
        authentikUserId: 'o1111111-1111-1111-1111-111111111111',
        email: 'owner1@gmail.com',
        fullName: 'Lê Hoàng Owner (Bố)',
        phone: '0988776655',
        role: 'owner',
        status: 'active'
      },
      // Child Dependents (Kids)
      {
        authentikUserId: 'c1111111-1111-1111-1111-111111111111',
        email: 'bean@ptalk.vn',
        fullName: 'Lê Hoàng An (Bé An)',
        phone: null,
        role: 'child',
        status: 'active'
      },
      {
        authentikUserId: 'c2222222-2222-2222-2222-222222222222',
        email: 'bechi@ptalk.vn',
        fullName: 'Lê Hoàng Chi (Bé Chi)',
        phone: null,
        role: 'child',
        status: 'active'
      },
      // Elder Dependents (Seniors)
      {
        authentikUserId: 'e1111111-1111-1111-1111-111111111111',
        email: 'ongbinh@ptalk.vn',
        fullName: 'Lê Văn Bình (Ông Bình)',
        phone: '0900001111',
        role: 'elder',
        status: 'active'
      }
    ]).returning();

    const admin = insertedUsers[0];
    const productAdmin = insertedUsers[1];
    const owner = insertedUsers[3];
    const childAn = insertedUsers[4];
    const childChi = insertedUsers[5];
    const elderBinh = insertedUsers[6];

    // 2. Seed User Relationships (Link Owner to Dependents)
    console.log('Seeding user relationships...');
    await db.insert(userRelationships).values([
      {
        ownerId: owner.id,
        dependentId: childAn.id,
        relationshipType: 'parent'
      },
      {
        ownerId: owner.id,
        dependentId: childChi.id,
        relationshipType: 'parent'
      },
      {
        ownerId: owner.id,
        dependentId: elderBinh.id,
        relationshipType: 'caregiver'
      }
    ]);

    // 3. Seed Product Enrollments (linking user ID to multi-products)
    console.log('Seeding product enrollments...');
    await db.insert(productEnrollments).values([
      // Owner enrolled in PTalk Assistant
      {
        userId: owner.id,
        productName: 'ptalk_assistant',
        status: 'active'
      },
      // Kids enrolled in both Assistant and Kid Mentor
      {
        userId: childAn.id,
        productName: 'ptalk_assistant',
        status: 'active'
      },
      {
        userId: childAn.id,
        productName: 'kid_mentor',
        status: 'active'
      },
      {
        userId: childChi.id,
        productName: 'ptalk_assistant',
        status: 'active'
      },
      {
        userId: childChi.id,
        productName: 'kid_mentor',
        status: 'active'
      },
      // Elder enrolled in Assistant and Elder Kare
      {
        userId: elderBinh.id,
        productName: 'ptalk_assistant',
        status: 'active'
      },
      {
        userId: elderBinh.id,
        productName: 'elder_kare',
        status: 'active'
      }
    ]);

    // 4. Seed Devices (PTalk Robots)
    console.log('Seeding devices...');
    const insertedDevices = await db.insert(devices).values([
      {
        serialNumber: 'PTALK-ROBOT-001',
        firmwareVersion: 'v2.1.0',
        status: 'online',
        lastSeen: new Date(),
        ownerId: owner.id,
        assignedUserId: childAn.id
      },
      {
        serialNumber: 'PTALK-ROBOT-002',
        firmwareVersion: 'v2.1.0',
        status: 'online',
        lastSeen: new Date(),
        ownerId: owner.id,
        assignedUserId: elderBinh.id
      },
      {
        serialNumber: 'PTALK-ROBOT-003',
        firmwareVersion: 'v2.0.4',
        status: 'offline',
        lastSeen: new Date(Date.now() - 3600000 * 2), // 2 hours ago
        ownerId: owner.id,
        assignedUserId: childChi.id
      }
    ]).returning();

    const deviceAn = insertedDevices[0];
    const deviceBinh = insertedDevices[1];
    const deviceChi = insertedDevices[2];

    // 5. Seed Configurations for Devices
    console.log('Seeding configurations...');
    await db.insert(robotConfigurations).values([
      {
        deviceId: deviceAn.id,
        voice: 'vi-VN-Wavenet-A (LISA)',
        language: 'vi-VN',
        personality: 'caring_mentor',
        volume: 85,
        updatedBy: owner.id
      },
      {
        deviceId: deviceBinh.id,
        voice: 'vi-VN-Standard-B',
        language: 'vi-VN',
        personality: 'calm_listener',
        volume: 95,
        updatedBy: owner.id
      },
      {
        deviceId: deviceChi.id,
        voice: 'vi-VN-Standard-C',
        language: 'vi-VN',
        personality: 'playful_friend',
        volume: 75,
        updatedBy: owner.id
      }
    ]);

    // 6. Seed Robot Conversations logs
    console.log('Seeding robot conversations...');
    await db.insert(robotConversations).values([
      {
        deviceId: deviceAn.id,
        userId: childAn.id,
        messageContent: 'LISA ơi, hôm nay học toán về cái gì thế?',
        responseContent: 'Chào Bé An! Hôm nay chúng ta sẽ cùng ôn tập các phép nhân trong phạm vi 10 nhé. Sẵn sàng chưa nào?',
        durationSeconds: 12,
        sentiment: 'positive'
      },
      {
        deviceId: deviceAn.id,
        userId: childAn.id,
        messageContent: 'Phép nhân 7 nhân 8 bằng bao nhiêu hả LISA?',
        responseContent: 'Phép nhân 7 nhân 8 bằng 56 đó Bé An. Bé An nhớ rất tốt đấy!',
        durationSeconds: 10,
        sentiment: 'positive'
      },
      {
        deviceId: deviceBinh.id,
        userId: elderBinh.id,
        messageContent: 'Bác thấy trong người hơi mệt mỏi.',
        responseContent: 'Bác Bình ơi, bác hãy ngồi nghỉ ngơi một chút nhé. Cháu thấy lịch nhắc nhở là đến giờ bác uống thuốc huyết áp rồi đấy ạ. Bác uống nước ấm và nghỉ ngơi nhé.',
        durationSeconds: 22,
        sentiment: 'negative'
      }
    ]);

    // 7. Seed Kid Mentor Learning Progress
    console.log('Seeding learning progress...');
    await db.insert(learningProgress).values([
      {
        userId: childAn.id,
        lessonsCompleted: 24,
        averageScore: 8.8,
        strongSubjects: ['Toán Học', 'Tiếng Anh'],
        weakSubjects: ['Lịch Sử'],
        timeSpentMinutes: 380,
        lastStudiedAt: new Date()
      },
      {
        userId: childChi.id,
        lessonsCompleted: 12,
        averageScore: 7.2,
        strongSubjects: ['Mỹ Thuật', 'Âm Nhạc'],
        weakSubjects: ['Toán Học'],
        timeSpentMinutes: 190,
        lastStudiedAt: new Date(Date.now() - 86400000) // 1 day ago
      }
    ]);

    // 8. Seed Elder Kare Medications list
    console.log('Seeding elder medications...');
    const medications = await db.insert(elderMedications).values([
      {
        userId: elderBinh.id,
        medicineName: 'Amlodipine (Thuốc huyết áp)',
        dosage: '5mg - 1 viên',
        scheduleTime: '08:00',
        status: 'active'
      },
      {
        userId: elderBinh.id,
        medicineName: 'Metformin (Thuốc tiểu đường)',
        dosage: '500mg - 1 viên',
        scheduleTime: '20:00',
        status: 'active'
      }
    ]).returning();

    // 9. Seed Medication Logs
    console.log('Seeding medication logs...');
    await db.insert(medicationLogs).values([
      {
        medicationId: medications[0].id,
        takenAt: new Date(new Date().setHours(8, 5, 0)), // Taken at 08:05
        status: 'taken'
      },
      {
        medicationId: medications[1].id,
        takenAt: null, // Missed last night
        status: 'missed'
      }
    ]);

    // 10. Seed Admin Audit Logs
    console.log('Seeding audit logs...');
    await db.insert(auditLogs).values([
      {
        userId: admin.id,
        action: 'ota_trigger',
        targetType: 'device',
        targetId: deviceBinh.id,
        details: { firmware_version: 'v2.1.0', status: 'initiated' }
      },
      {
        userId: productAdmin.id,
        action: 'update_configuration',
        targetType: 'configuration',
        targetId: deviceAn.id,
        details: { voice: 'vi-VN-Wavenet-A', volume: 85 }
      }
    ]);

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

