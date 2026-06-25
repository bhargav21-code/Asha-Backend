require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Seeding...');

  await User.deleteMany({});

  await User.create([
    {
      name: 'Admin User',
      username: 'admin',
      password: 'admin123',
      role: 'Admin',
      assigned_villages: [],
    },
    {
      name: 'Meena ASHA',
      username: 'meena',
      password: 'asha123',
      role: 'ASHA',
      assigned_villages: ['Rampur', 'Sitapur'],
    },
    {
      name: 'Kavita ASHA',
      username: 'kavita',
      password: 'asha123',
      role: 'ASHA',
      assigned_villages: ['Nandpur', 'Gopalganj'],
    },
  ]);

  console.log('✅ Seed complete!');
  console.log('Admin login: admin / admin123');
  console.log('ASHA login: meena / asha123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
