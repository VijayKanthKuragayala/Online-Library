const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(express.static(path.join(__dirname, "../../client")));
const db = new sqlite3.Database("data.db");

app.use(
  session({
    secret: "rirkrmAA344AAdkjdsnre5-58gkjg",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);
// Create the admin table
db.run(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL
  )
`);

//  default admin values
/*db.run(`
  INSERT INTO admin (username, password)
  VALUES ('admin', 'x86admin')
`);*/
// create the member database if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY,
    name TEXT,
    contact_details TEXT UNIQUE, -- Set as a unique key
    membership_status TEXT
  )
`);

// create the book table
db.run(
  "CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT, author TEXT,description TEXT, genre TEXT)"
);

//db.run("DROP TABLE IF EXISTS book_issues");

// create the issue book table
db.run(
  "CREATE TABLE IF NOT EXISTS book_issues (id INTEGER PRIMARY KEY, member_contact TEXT, book_title TEXT, issuance_date TEXT, due_date TEXT)"
);

app.get("/add-member", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client") + "/src/addMember.html");
});
app.post("/save-member", (req, res) => {
  const { memberName, contactDetails, membershipStatus } = req.body;
  if (!req.session.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Insert data into the member table
  db.run(
    "INSERT INTO members (name, contact_details, membership_status) VALUES (?, ?, ?)",
    memberName,
    contactDetails,
    membershipStatus,
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.redirect("/add-member");
    }
  );
});

app.delete("/delete-member/:contactDetails", (req, res) => {
  const contactDetails = req.params.contactDetails;
  if (!req.session.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Check if the member exists
  db.get(
    "SELECT * FROM members WHERE contact_details = ?",
    contactDetails,
    (err, memberRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!memberRow) {
        // Member not found
        return res.status(404).json({ message: "Member not found." });
      }

      // delete member if available
      db.run(
        "DELETE FROM members WHERE contact_details = ?",
        contactDetails,
        (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          res.json({ message: "Member deleted successfully." });
        }
      );
    }
  );
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client") + "/src/index.html");
});

// get memeber by contact detail
app.get("/members/:contactDetails", (req, res) => {
  const { contactDetails } = req.params;

  // Query the database for members with the specified contact details
  db.all(
    "SELECT * FROM members WHERE contact_details = ?",
    contactDetails,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({ members: rows });
    }
  );
});
app.get("/view-members", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client") + "/src/ViewMembers.html");
});
//  fetch all members
app.get("/all-members", (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  db.all("SELECT * FROM members", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({ members: rows });
  });
});

//book routes
app.get("/add-book", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client") + "/src/addBook.html");
});

// Handle book submission
app.post("/add-book", (req, res) => {
  const { bookTitle, author, description, genre } = req.body;
  if (!req.session.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  db.run(
    "INSERT INTO books (title, author,description, genre) VALUES (?, ?, ?, ?)",
    bookTitle,
    author,
    description,
    genre,
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.redirect("/add-book");
    }
  );
});

app.get("/all-books", (req, res) => {
  db.all("SELECT * FROM books", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({ books: rows });
  });
});

app.get("/all-books/:genre", (req, res) => {
  const { genre } = req.params;
  // If a genre is specified, filter books by genre; otherwise, retrieve all books
  const query = genre
    ? "SELECT * FROM books WHERE genre = ?"
    : "SELECT * FROM books";

  const params = genre ? [genre] : [];

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({ books: rows });
  });
});

app.get("/books/:id", (req, res) => {
  const { id } = req.params;

  // Query the database for the book with the specified ID
  db.get("SELECT * FROM books WHERE id = ?", id, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json({ book: row });
  });
});

//  search for books by name, phrase, or ID
app.get("/books/search/:query", (req, res) => {
  const { query } = req.params;
  db.all(
    "SELECT * FROM books WHERE title LIKE ? OR id = ?",
    [`%${query}%`, query],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ message: "No books found matching the query" });
      }

      res.json({ books: rows });
    }
  );
});
app.delete("/delete-book/:title", (req, res) => {
  const bookTitle = req.params.title;
  if (!req.session.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Check if the book has been issued
  db.get(
    "SELECT * FROM book_issues WHERE book_title = ?",
    bookTitle,
    (err, issuedBookRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (issuedBookRow) {
        // Book has been issued, return a JSON response
        return res.status(400).json({
          deleted: false,
          message: "The book has been issued and cannot be deleted.",
        });
      }

      // Book is not issued, proceed with deletion
      db.run("DELETE FROM books WHERE title = ?", bookTitle, (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        res.json({ deleted: true, message: "Book deleted successfully." });
      });
    }
  );
});

//issue book routes
app.get("/issue-book", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client") + "/src/issueBook.html");
});
app.get("/issued-books", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../client") + "/src/ViewIssuedBooks.html"
  );
});
app.get("/all-issued-books", (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  db.all("SELECT * FROM book_issues", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ issuedBooks: rows });
  });
});

app.post("/issue-book", (req, res) => {
  const { memberInput, bookInput, issuanceDate, dueDate } = req.body;
  if (!req.session.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Check if the member exists
  db.get(
    "SELECT * FROM members WHERE contact_details = ?",
    memberInput,
    (err, memberRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!memberRow) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Check if the book exists
      db.get(
        "SELECT * FROM books WHERE title = ?",
        bookInput,
        (err, bookRow) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          if (!bookRow) {
            return res.status(404).json({ message: "Book not found" });
          }

          // Insert book issuance data into the database directly using member contact
          db.run(
            "INSERT INTO book_issues (member_contact, book_title, issuance_date, due_date) VALUES (?, ?, ?, ?)",
            memberInput,
            bookInput,
            issuanceDate,
            dueDate,
            (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              res.redirect("/issue-book");
            }
          );
        }
      );
    }
  );
});

app.get("/return-book", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client") + "/src/returnBook.html");
});

app.post("/return-book-issued", (req, res) => {
  const { memberContact, bookTitle } = req.body;
  if (!req.session.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Check if the member exists
  db.get(
    "SELECT * FROM members WHERE contact_details = ?",
    memberContact,
    (err, memberRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!memberRow) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Check if the book exists
      db.get(
        "SELECT * FROM books WHERE title = ?",
        bookTitle,
        (err, bookRow) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          if (!bookRow) {
            return res.status(404).json({ message: "Book not found" });
          }

          // Check if the book was issued to the member
          db.get(
            "SELECT * FROM book_issues WHERE member_contact = ? AND book_title = ?",
            memberContact,
            bookTitle,
            (err, issuedBookRow) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              if (!issuedBookRow) {
                return res
                  .status(404)
                  .json({ message: "Book was not issued to the member" });
              }

              // Remove the book entry from the book_issues table
              db.run(
                "DELETE FROM book_issues WHERE member_contact = ? AND book_title = ?",
                memberContact,
                bookTitle,
                (err) => {
                  if (err) {
                    return res.status(500).json({ error: err.message });
                  }

                  res.redirect("/return-book");
                }
              );
            }
          );
        }
      );
    }
  );
});
app.get("/my-status", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client") + "/src/myStatus.html");
});

app.get("/has-member-defaulted", (req, res) => {
  const { memberContact, bookTitle } = req.query;
  if (!req.session.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Check if the member exists
  db.get(
    "SELECT * FROM members WHERE contact_details = ?",
    memberContact,
    (err, memberRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!memberRow) {
        return res.status(404).json({ message: "Member not found" });
      }

      // Check if the book exists
      db.get(
        "SELECT * FROM books WHERE title = ?",
        bookTitle,
        (err, bookRow) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          if (!bookRow) {
            return res.status(404).json({ message: "Book not found" });
          }

          // Check if the book was issued to the member
          db.get(
            "SELECT * FROM book_issues WHERE member_contact = ? AND book_title = ?",
            memberContact,
            bookTitle,
            (err, issuedBookRow) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              if (!issuedBookRow) {
                return res
                  .status(404)
                  .json({ message: "Book was not issued to the member" });
              }

              // Calculate the number of days overdue
              const returnDate = new Date();
              const dueDate = new Date(issuedBookRow.due_date);
              const daysOverdue = Math.max(
                0,
                Math.floor((returnDate - dueDate) / (1000 * 60 * 60 * 24))
              );

              // Calculate the fine $5 per day penalty
              const fineAmount = 5 * daysOverdue;

              res.json({
                fine: fineAmount,
                daysOverdue: daysOverdue,
                defaulted: fineAmount > 0,
              });
            }
          );
        }
      );
    }
  );
});

app.get("/get-member-status/:contactDetails", (req, res) => {
  const { contactDetails } = req.params;

  // Check if the member exists
  db.get(
    "SELECT * FROM members WHERE contact_details = ?",
    contactDetails,
    (err, memberRow) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!memberRow) {
        return res.status(404).json({ message: "Member not found." });
      }

      db.all(
        "SELECT * FROM book_issues INNER JOIN books ON book_issues.book_title = books.title WHERE member_contact = ?",
        contactDetails,
        (err, issuedBooks) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          res.json({
            member: {
              name: memberRow.name,
              contactDetails: memberRow.contact_details,
              membershipStatus: memberRow.membership_status,
            },
            issuedBooks: issuedBooks,
          });
        }
      );
    }
  );
});
app.get("/login/form", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client") + "/src/login.html");
});

//admin login
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM admin WHERE username = ? AND password = ?",
    [username, password],
    (err, admin) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (admin) {
        req.session.admin = admin;
        return res.redirect("/home");
      }

      res.status(401).json({ message: "Invalid credentials" });
    }
  );
});

app.get("/admin/logout", (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Unable to logout" });
    }

    res.json({ message: "Logout successful" });
  });
});

app.get("/admin/dashboard", (req, res) => {
  // Check if the admin is authenticated
  if (!req.session.admin) {
    return res.status(200).json({ message: "Unauthorized" });
  }
  res.json({
    message: "Welcome to the admin dashboard",
    admin: req.session.admin,
  });
});
app.listen(5000, (req, res) => {
  console.log(path.join(__dirname, "../../client"));
  console.log("server started on port 5000");
});
