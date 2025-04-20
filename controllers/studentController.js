import pool from '../db.js';
import moment from 'moment-timezone';

// ---- Students ----
export const getAllStudents = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE user_id = $1', 
      [req.userId]
    );
    
    const formattedRows = result.rows.map(row => ({
      ...row,
      dob: moment(row.dob).format('DD-MM-YYYY')
    }));
    res.json(formattedRows);
  } catch (error) {
    console.error('getAllStudents error:', error);
    res.status(500).json({ message: 'Error fetching students: ' + error.message });
  }
};

export const addStudent = async (req, res) => {
  const { first_name, last_name, dob, gender, email, phone, address } = req.body;
  try {
    const parsedDob = moment(dob, 'DD-MM-YYYY').format('YYYY-MM-DD');
    const result = await pool.query(
      `INSERT INTO students 
       (first_name, last_name, dob, gender, email, phone, address, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [first_name, last_name, parsedDob, gender, email, phone, address, req.userId]
    );
    
    result.rows[0].dob = moment(result.rows[0].dob).format('DD-MM-YYYY');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('addStudent error:', error);
    res.status(400).json({ message: 'Error adding student: ' + error.message });
  }
};

export const updateStudent = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, dob, gender, email, phone, address } = req.body;

  try {
    const parsedDob = moment(dob, moment.ISO_8601, true).isValid()
      ? dob
      : moment(dob, 'DD-MM-YYYY').format('YYYY-MM-DD');

    const result = await pool.query(
      `UPDATE students SET 
       first_name=$1, last_name=$2, dob=$3, gender=$4, email=$5, phone=$6, address=$7 
       WHERE id=$8 AND user_id=$9 
       RETURNING *`,
      [first_name, last_name, parsedDob, gender, email, phone, address, id, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Student not found or unauthorized' });
    }

    result.rows[0].dob = moment(result.rows[0].dob).format('DD-MM-YYYY');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateStudent error:', error);
    res.status(400).json({ message: 'Error updating student: ' + error.message });
  }
};

export const deleteStudent = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM students WHERE id=$1 AND user_id=$2 RETURNING *', 
      [id, req.userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Student not found or unauthorized' });
    }
    
    res.json({ message: 'Student deleted' });
  } catch (error) {
    console.error('deleteStudent error:', error);
    res.status(400).json({ message: 'Error deleting student: ' + error.message });
  }
};

// ---- Courses ----
export const getAllCourses = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM courses WHERE user_id = $1', 
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('getAllCourses error:', error);
    res.status(500).json({ message: 'Error fetching courses: ' + error.message });
  }
};

export const addCourse = async (req, res) => {
  const { course_name, course_code, course_description } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO courses 
       (course_name, course_code, course_description, user_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [course_name, course_code, course_description, req.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('addCourse error:', error);
    res.status(400).json({ message: 'Error adding course: ' + error.message });
  }
};

export const updateCourse = async (req, res) => {
  const { id } = req.params;
  const { course_name, course_code, course_description } = req.body;

  try {
    const result = await pool.query(
      `UPDATE courses SET 
       course_name=$1, course_code=$2, course_description=$3 
       WHERE id=$4 AND user_id=$5 
       RETURNING *`,
      [course_name, course_code, course_description, id, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateCourse error:', error);
    res.status(400).json({ message: 'Error updating course: ' + error.message });
  }
};

export const deleteCourse = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM courses WHERE id=$1 AND user_id=$2 RETURNING *', 
      [id, req.userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }
    
    res.json({ message: 'Course deleted' });
  } catch (error) {
    console.error('deleteCourse error:', error);
    res.status(400).json({ message: 'Error deleting course: ' + error.message });
  }
};

// ---- Enrollments ----
export const enrollStudent = async (req, res) => {
  const { student_id, course_id } = req.body;
  try {
    // Validate student and course belong to the user
    const [studentCheck, courseCheck] = await Promise.all([
      pool.query('SELECT id FROM students WHERE id = $1 AND user_id = $2', [student_id, req.userId]),
      pool.query('SELECT id FROM courses WHERE id = $1 AND user_id = $2', [course_id, req.userId])
    ]);

    if (studentCheck.rowCount === 0 || courseCheck.rowCount === 0) {
      return res.status(400).json({ 
        message: studentCheck.rowCount === 0 ? 'Invalid student_id' : 'Invalid course_id'
      });
    }

    const today = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
    
    const result = await pool.query(`
      WITH inserted AS (
        INSERT INTO enrollments (student_id, course_id, enrollment_date, user_id)
        VALUES ($1, $2, $3::date, $4)
        RETURNING id, student_id, course_id, enrollment_date
      )
      SELECT i.id, i.student_id, i.course_id, i.enrollment_date,
             s.first_name, s.last_name, c.course_name
      FROM inserted i
      JOIN students s ON i.student_id = s.id
      JOIN courses c ON i.course_id = c.id
    `, [student_id, course_id, today, req.userId]);

    const enrollment = result.rows[0];
    enrollment.enrollment_date = moment(enrollment.enrollment_date).format('DD-MM-YYYY');
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
      JOIN students s ON e.student_id = s.id AND s.user_id = $1
      JOIN courses c ON e.course_id = c.id AND c.user_id = $1
      WHERE e.user_id = $1
    `, [req.userId]);
    
    const formattedRows = result.rows.map(row => ({
      ...row,
      enrollment_date: moment(row.enrollment_date).format('DD-MM-YYYY')
    }));
    res.json(formattedRows);
  } catch (error) {
    console.error('getEnrollments error:', error);
    res.status(500).json({ message: 'Error fetching enrollments: ' + error.message });
  }
};

export const deleteEnrollment = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM enrollments WHERE id=$1 AND user_id=$2 RETURNING *', 
      [id, req.userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Enrollment not found or unauthorized' });
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
  try {
    // Validate student and course belong to the user
    const [studentCheck, courseCheck] = await Promise.all([
      pool.query('SELECT id FROM students WHERE id = $1 AND user_id = $2', [student_id, req.userId]),
      pool.query('SELECT id FROM courses WHERE id = $1 AND user_id = $2', [course_id, req.userId])
    ]);

    if (studentCheck.rowCount === 0 || courseCheck.rowCount === 0) {
      return res.status(400).json({ 
        message: studentCheck.rowCount === 0 ? 'Invalid student_id' : 'Invalid course_id'
      });
    }

    const result = await pool.query(
      `INSERT INTO marks 
       (student_id, course_id, marks, semester, user_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [student_id, course_id, marks, semester, req.userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('addMarks error:', error);
    res.status(400).json({ message: 'Error adding marks: ' + error.message });
  }
};

export const getMarks = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.student_id, m.course_id, m.marks, m.semester, 
             s.first_name, s.last_name, c.course_name
      FROM marks m
      JOIN students s ON m.student_id = s.id AND s.user_id = $1
      JOIN courses c ON m.course_id = c.id AND c.user_id = $1
      WHERE m.user_id = $1
    `, [req.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('getMarks error:', error);
    res.status(500).json({ message: 'Error fetching marks: ' + error.message });
  }
};

export const updateMarks = async (req, res) => {
  const { id } = req.params;
  const { student_id, course_id, marks, semester } = req.body;
  try {
    const result = await pool.query(
      `UPDATE marks SET 
       student_id=COALESCE($1, student_id), 
       course_id=COALESCE($2, course_id), 
       marks=COALESCE($3, marks), 
       semester=COALESCE($4, semester) 
       WHERE id=$5 AND user_id=$6 
       RETURNING *`,
      [student_id, course_id, marks, semester, id, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Marks not found or unauthorized' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateMarks error:', error);
    res.status(400).json({ message: 'Error updating marks: ' + error.message });
  }
};

export const deleteMarks = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM marks WHERE id=$1 AND user_id=$2 RETURNING *', 
      [id, req.userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Marks not found or unauthorized' });
    }
    
    res.json({ message: 'Marks deleted' });
  } catch (error) {
    console.error('deleteMarks error:', error);
    res.status(400).json({ message: 'Error deleting marks: ' + error.message });
  }
};