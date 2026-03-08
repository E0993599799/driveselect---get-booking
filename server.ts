import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-123";
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
  app.post("/api/register", async (req, res) => {
    const { username, password, name, position, organization, internal_tel, mobile_tel } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const { data, error } = await supabase
        .from('users')
        .insert([{ username, password: hashedPassword, name, position, organization, internal_tel, mobile_tel, role: 'user' }])
        .select('id');

      if (error) {
        console.error(error);
        return res.status(400).json({ error: error.message });
      }

      res.json({ id: data[0].id });
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "Username already exists or invalid data" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const { data: users, error } = await supabase.from('users').select('*').eq('username', username).limit(1);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    const user = users?.[0];

    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
      const { password: _, ...userWithoutPassword } = user;
      res.json({ token, user: userWithoutPassword });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/me", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const { data: users, error } = await supabase.from('users').select('*').eq('id', decoded.id).limit(1);

      if (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
      }

      const user = users?.[0];

      if (!user) return res.status(404).json({ error: "User not found" });
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // API Routes
  app.get("/api/cars", async (req, res) => {
    const { data: cars, error } = await supabase.from('cars').select('*');
    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
    res.json(cars);
  });

  app.post("/api/cars", async (req, res) => {
    const { name, type, image, license_plate, seats } = req.body;
    const { data, error } = await supabase
      .from('cars')
      .insert([{ name, type, image, license_plate, seats }])
      .select('id');

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ id: data[0].id });
  });

  app.patch("/api/cars/:id", async (req, res) => {
    const { name, type, image, license_plate, seats } = req.body;
    const { error } = await supabase
      .from('cars')
      .update({ name, type, image, license_plate, seats })
      .eq('id', req.params.id);

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  });

  app.delete("/api/cars/:id", async (req, res) => {
    const { error } = await supabase
      .from('cars')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  });

  // Driver Routes
  app.get("/api/drivers", async (req, res) => {
    const { data: drivers, error } = await supabase.from('drivers').select('*');
    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
    res.json(drivers);
  });

  app.post("/api/drivers", async (req, res) => {
    const { name, tel, image } = req.body;
    const { data, error } = await supabase
      .from('drivers')
      .insert([{ name, tel, image }])
      .select('id');

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ id: data[0].id });
  });

  app.patch("/api/drivers/:id", async (req, res) => {
    const { name, tel, image } = req.body;
    const { error } = await supabase
      .from('drivers')
      .update({ name, tel, image })
      .eq('id', req.params.id);

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  });

  app.delete("/api/drivers/:id", async (req, res) => {
    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  });

  app.get("/api/bookings", async (req, res) => {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *, 
        cars(name, license_plate, type),
        drivers(name, tel)
      `);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    // Flatten the car and driver data for consistency with the original response structure
    const formattedBookings = bookings.map(booking => ({
      ...booking,
      car_name: booking.cars?.name,
      car_license: booking.cars?.license_plate,
      car_type: booking.cars?.type,
      driver_name: booking.drivers?.name,
      driver_tel: booking.drivers?.tel,
      cars: undefined, // Remove nested car object
      drivers: undefined, // Remove nested driver object
    }));

    res.json(formattedBookings);
  });

  app.post("/api/bookings", async (req, res) => {
    const {
      car_id, user_id, user_name, user_position, user_organization, tel,
      objective, passenger, note, date_start, date_finish, time_start, time_finish
    } = req.body;

    const { data, error } = await supabase
      .from('bookings')
      .insert([
        {
          car_id, user_id, user_name, user_position, user_organization, tel,
          objective, passenger, note, date_start, date_finish, time_start, time_finish
        }
      ])
      .select('id');

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ id: data[0].id });
  });

  app.patch("/api/bookings/:id", async (req, res) => {
    const { status, reject_reason, driver_id } = req.body;
    const updateData: { status: string, reject_reason?: string | null, driver_id?: number | null } = { status };

    if (reject_reason !== undefined) {
      updateData.reject_reason = reject_reason;
    }
    if (driver_id !== undefined) {
      updateData.driver_id = driver_id;
    }

    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', req.params.id);

    if (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
