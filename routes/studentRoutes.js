import express from 'express';
import {
  getAllStudents,
  addStudent,
  updateStudent,
  deleteStudent,
  getAllCourses,
  addCourse,
  deleteCourse,
  enrollStudent,
  getEnrollments,
  deleteEnrollment,
  addMarks,
  getMarks,
  updateMarks,
  deleteMarks
} from '../controllers/studentController.js';

const router = express.Router();

// Students
router.get('/students', getAllStudents);
router.post('/students', addStudent);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);

// Courses
router.get('/courses', getAllCourses);
router.post('/courses', addCourse);
router.delete('/courses/:id', deleteCourse);

// Enrollments
router.get('/enrollments', getEnrollments);
router.post('/enrollments', enrollStudent);
router.delete('/enrollments/:id', deleteEnrollment);

// Marks
router.get('/marks', getMarks);
router.post('/marks', addMarks);
router.put('/marks/:id', updateMarks);
router.delete('/marks/:id', deleteMarks);

export default router;