const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: 1,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  _projectid: {
    type: mongoose.Types.ObjectId,
    required: true
  }
});

const task = mongoose.model("Task", TaskSchema);

module.exports = { task };
