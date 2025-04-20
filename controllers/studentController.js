import pool from '../db.js';
import moment from 'moment';

// ---- Students ----
export const getAllStudents = async (req, res) => {
  const result = await pool.query('SELECT * FROM students');
  res.json(result.rows);
};

export const addStudent = async (req, res) => {
  const { first_name, last_name, dob, gender, email, phone, address } = req.body;
  // Parse dob from dd-mm-yyyy to YYYY-MM-DD
  const parsedDob = moment(dob, 'DD-MM-YYYY').format('YYYY-MM-DD');
  const result = await pool.query(
    'INSERT INTO students (first_name, last_name, dob, gender, email, phone, address) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [first_name, last_name, parsedDob, gender, email, phone, address]
  );
  // Format dob back to dd-mm-yyyy for response
  result.rows[0].dob = moment(result.rows[0].dob).format('DD-MM-YYYY');
  res.json(result.rows[0]);
};

export const updateStudent = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, dob, gender, email, phone, address } = req.body;
  // Parse dob from dd-mm-yyyy to YYYY-MM-DD
  const parsedDob = moment(dob, 'DD-MM-YYYY').format('YYYY-MM-DD');
  const result = await pool.query(
    'UPDATE students SET first_name=$1, last_name=$2, dob=$3, gender=$4, email=$5, phone=$6, address=$7 WHERE id=$8 RETURNING *',
    [first_name, last_name, parsedDob, gender, email, phone, address, id]
  );
  // Format dob back to dd-mm-yyyy for response
  result.rows[0].dob = moment(result.rows[0].dob).format('DD-MM-YYYY');
  res.json(result.rows[0]);
};

export const deleteStudent = async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM students WHERE id=$1', [id]);
  res.json({ message: 'Student deleted' });
};

// ---- Courses ----
export const getAllCourses = async (req, res) => {
  const result = await pool.query('SELECT * FROM courses');
  res.json(result.rows);
};

export const addCourse = async (req, res) => {
  const { course_name, course_code, course_description } = req.body;
  const result = await pool.query(
    'INSERT INTO courses (course_name, course_code, course_description) VALUES ($1, $2, $3) RETURNING *',
    [course_name, course_code, course_description]
  );
  res.json(result.rows[0]);
};

export const deleteCourse = async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM courses WHERE id=$1', [id]);
  res.json({ message: 'Course deleted' });
};

// ---- Enrollments ----
export const enrollStudent = async (req, res) => {
  const { student_id, course_id } = req.body;
  try {
    // Validate student_id and course_id
    const studentCheck = await pool.query('SELECT id FROM students WHERE id = $1', [student_id]);
    const courseCheck = await pool.query('SELECT id FROM courses WHERE id = $1', [course_id]);
    if (studentCheck.rowCount === 0) {
      return res.status(400).json({ message: 'Invalid student_id' });
    }
    if (courseCheck.rowCount === 0) {
      return res.status(400).json({ message: 'Invalid course_id' });
    }
    // Insert enrollment and fetch details with a CTE
    const result = await pool.query(`
      WITH inserted AS (
        INSERT INTO enrollments (student_id, course_id)
        VALUES ($1, $2)
        RETURNING id, student_id, course_id, enrollment_date
      )
      SELECT i.id, i.student_id, i.course_id, i.enrollment_date,
             s.first_name, s.last_name, c.course_name
      FROM inserted i
      JOIN students s ON i.student_id = s.id
      JOIN courses c ON i.course_id = c.id
    `, [student_id, course_id]);
    // Format enrollment_date to dd-mm-yyyy
    const enrollment = result.rows[0];
    enrollment.enrollment_date = moment(enrollment.enrollment_date).format('DD-MM-YYYY');
    console.log('enrollStudent response:', enrollment);
    res.json(enrollment);
  } catch (error) {
    console.error('enrollStudent error:', error);
    res.status(400).json({ message: 'Error enrolling student: ' + error.message });
  }
};

export const getEnrollments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id, s.first_name, s.last_name, c.course_name, e.enrollment_date
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN courses c ON e.course_id = c.id
    `);
    // Format enrollment_date to dd-mm-yyyy
    const formattedRows = result.rows.map(row => ({
      ...row,
      enrollment_date: moment(row.enrollment_date).format('DD-MM-YYYY')
    }));
    console.log('getEnrollments response:', formattedRows);
    res.json(formattedRows);
  } catch (error) {
    console.error('getEnrollments error:', error);
    res.status(500).json({ message: 'Error fetching enrollments: ' + error.message });
  }
};

export const deleteEnrollment = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM enrollments WHERE id=$1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    res.json({ message: 'Enrollment deleted' });
  } catch (error) {
    console.error('deleteEnrollment error:', error);
    res.status(400).json({ message: 'Error deleting enrollment: ' + error.message });
  }
};

// ---- Marks ----
export const addMarks = async (req, res) => {
  const { student_id, course_id, marks, semester } = req.body;
  const result = await pool.query(
    'INSERT INTO marks (student_id, course_id, marks, semester) VALUES ($1, $2, $3, $4) RETURNING *',
    [student_id, course_id, marks, semester]
  );
  res.json(result.rows[0]);
};

export const getMarks = async (req, res) => {
  const result = await pool.query(`
    SELECT m.id, m.student_id, m.course_id, m.marks, m.semester, 
           s.first_name, s.last_name, c.course_name
    FROM marks m
    JOIN students s ON m.student_id = s.id
    JOIN courses c ON m.course_id = c.id
  `);
  res.json(result.rows);
};

export const updateMarks = async (req, res) => {
  const { id } = req.params;
  const { student_id, course_id, marks, semester } = req.body;
  const result = await pool.query(
    'UPDATE marks SET student_id=$1, course_id=$2, marks=$3, semester=$4 WHERE id=$5 RETURNING *',
    [student_id, course_id, marks, semester, id]
  );
  res.json(result.rows[0]);
};

export const deleteMarks = async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM marks WHERE id=$1', [id]);
  res.json({ message: 'Marks deleted' });
};