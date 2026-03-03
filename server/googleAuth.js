const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("./db");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;

        if (!email) return done(null, false);

        const sql = "SELECT * FROM users WHERE email = ?";
        db.query(sql, [email], (err, results) => {
          if (err) return done(err);

          // user exists
          if (results.length > 0) return done(null, results[0]);

          // create new user with verified = 1 because google email is verified
          const insertSql = `
            INSERT INTO users (name, email, password, role, is_verified)
            VALUES (?, ?, ?, ?, ?)
          `;

          db.query(insertSql, [name, email, "", "user", 1], (err2, result) => {
            if (err2) return done(err2);

            const newUser = {
              id: result.insertId,
              name,
              email,
              role: "user",
              is_verified: 1,
            };

            return done(null, newUser);
          });
        });
      } catch (e) {
        return done(e);
      }
    }
  )
);

module.exports = passport;
