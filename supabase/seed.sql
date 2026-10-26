-- Seed data for manual testing. Run after schema.sql.
-- Admin login: admin@school.edu / admin123
insert into admins (email, password_hash, role)
values ('admin@school.edu', '$2b$10$g/0v/UcpS8X92spkPdxwDuhnb/FzN8hTdnK02p8QiXLnaEGL6fkvi', 'admin')
on conflict (email) do nothing;

-- Sample student (code: TESTCODE)
insert into students (student_number, full_name, grade_level, code_hash)
values ('S001', 'John Doe', 'G7', '$2b$10$golVLDrG1K0UWuOVqdseGOocfcY6UD/nFpTz46lqKZ2X34xdxzttq')
on conflict do nothing;
