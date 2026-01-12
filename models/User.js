const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  whatsapp: { type: String, required: true },
});

// CORRECCIÓN: Eliminamos 'next' porque usamos async/await
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  
  // Encriptar contraseña
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model('User', UserSchema);