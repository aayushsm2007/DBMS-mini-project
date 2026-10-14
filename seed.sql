USE QuickBite;

-- Restaurant/menu data is management data,
-- so it is okay to seed it for the college demo.
-- Customer/order/review data is NOT hard-coded here.

INSERT INTO Restaurant (name, location, cuisine, contact, rating)
VALUES
('Food Hub', 'FC Road', 'Fast Food', '9000000001', 4.5),
('Spice Villa', 'Kothrud', 'Indian', '9000000002', 4.2),
('Pizza Point', 'Baner', 'Italian', '9000000003', 4.6);

INSERT INTO Category (category_name)
VALUES
('Pizza'),
('Burger'),
('Indian'),
('Beverages');

INSERT INTO Food_Item
(restaurant_id, category_id, item_name, price, availability)
VALUES
(1, 2, 'Cheese Burger', 150.00, TRUE),
(1, 4, 'Cold Coffee', 100.00, TRUE),
(2, 3, 'Paneer Biryani', 220.00, TRUE),
(2, 3, 'Butter Naan', 60.00, TRUE),
(3, 1, 'Margherita Pizza', 250.00, TRUE),
(3, 1, 'Farmhouse Pizza', 350.00, TRUE);

INSERT INTO Delivery_Partner (name, phone, vehicle_no)
VALUES
('Amit', '9011111111', 'MH12AB1234'),
('Rohan', '9022222222', 'MH12CD5678'),
('Karan', '9033333333', 'MH14EF9012');

-- Demo admin password is: admin123
-- bcrypt hash generated for the project.
INSERT INTO Admin (username, password)
VALUES
('admin', '$2a$10$7EqJtq98hPqEX7fNZaFWoO6XkJq3H6G6g3uK3fQ7u0e6rV0Vw0m2G');
