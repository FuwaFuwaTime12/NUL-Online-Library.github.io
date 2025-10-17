

const BORROW_LIMIT = 3;
const BORROW_DAYS = 7;
const FINE_PER_DAY = 5; // 5 Pessos
const LOST_BOOK_FINE = 500; // fixed replacement cost


/* ----------------------------------------------------------
   Initialize Books
---------------------------------------------------------- */
function initializeBooks() {
  if (!localStorage.getItem("availableBooks")) {
    const books = [
      { id: 1, title: "A Short History of Nearly Everything", author: "Bill Bryson", cover: "/images/user/books/21.jpg" },
      { id: 2, title: "Educated", author: "Tara Westover", cover: "/images/user/books/educated.jpg" },
      { id: 3, title: "Sapiens", author: "Yuval Noah Harari", cover: "/images/user/books/sapiens.jpg" },
      { id: 4, title: "Sheever’s Journal", author: "K. Ritz", cover: "/images/user/books/sheevers.jpg" },
      { id: 5, title: "The Subtle Art of Not Giving a F*ck", author: "Mark Manson", cover: "/images/user/books/subtle.jpg" },
      { id: 6, title: "The Bell Jar", author: "Sylvia Plath", cover: "/images/user/books/The Bell Jar.jpg" },
      { id: 7, title: "The Watchers", author: "A.M. Shine", cover: "/images/user/books/the watchers.jpg" },
      { id: 8, title: "Crime and Punishment", author: "Fyodor Dostoevsky", cover: "/images/user/books/Crime and Punishment.jpg" },
      { id: 9, title: "The Diary Of Anaïs Nin", author: "Anaïs Nin", cover: "/images/user/books/ana.jpg" },
      { id: 10, title: "Goodnight Punpun", author: "Inio Asano", cover: "/images/user/books/punpun.jpg" }
    ].map(book => ({
      ...book,
      price: Math.floor(Math.random() * 801) + 200 // price random
    }));

    localStorage.setItem("availableBooks", JSON.stringify(books));
  }
}
function getCurrentUser() {
  return localStorage.getItem("currentUser") || "Guest";
}

/* ----------------------------------------------------------
   Borrow Book
---------------------------------------------------------- */
function borrowBook(id) {
  const user = getCurrentUser();
  const available = JSON.parse(localStorage.getItem("availableBooks")) || [];
  const borrowedBooks = JSON.parse(localStorage.getItem("borrowedBooks_" + user) || "[]");
  const payments = JSON.parse(localStorage.getItem("payments_" + user) || "[]");

  // Check for unpaid fines before borrowing
  const hasUnpaidFines = payments.some(p => p.status === "Unpaid");
  if (hasUnpaidFines) {
    alert(`${user}, you still have unpaid balances. Please settle them before borrowing new books.`);
    return;
  }

  // logic
  if (borrowedBooks.length >= BORROW_LIMIT) {
    alert(`${user}, you can only borrow up to ${BORROW_LIMIT} books at a time.`);
    return;
  }

  const book = available.find(b => b.id === id);
  if (!book) {
    alert("This book has already been borrowed by another user.");
    return;
  }

  const now = new Date();
  const due = new Date();
  due.setDate(now.getDate() + BORROW_DAYS);

  borrowedBooks.push({
    ...book,
    borrowDate: now.toISOString(),
    dueDate: due.toISOString(),
    renewed: false
  });

  // Remove from shared pool
  const updatedAvailable = available.filter(b => b.id !== id);

  localStorage.setItem("availableBooks", JSON.stringify(updatedAvailable));
  localStorage.setItem("borrowedBooks_" + user, JSON.stringify(borrowedBooks));
  updateBorrowableCount();

  alert(`${book.title} has been borrowed by ${user}.`);
  location.reload();
}

/* ----------------------------------------------------------
   Return Book
---------------------------------------------------------- */
function returnBook(id) {
  const user = getCurrentUser();
  let borrowedBooks = JSON.parse(localStorage.getItem("borrowedBooks_" + user) || "[]");
  let available = JSON.parse(localStorage.getItem("availableBooks") || "[]");

  const returned = borrowedBooks.find(b => b.id === id);
  if (!returned) return;

  const now = new Date();
  const due = new Date(returned.dueDate);
  const overdueDays = Math.max(0, Math.ceil((now - due) / (1000 * 60 * 60 * 24)));
  const fine = overdueDays * FINE_PER_DAY;

  // Add back to shared library
  available.push({
    id: returned.id,
    title: returned.title,
    author: returned.author,
    cover: returned.cover
  });

  borrowedBooks = borrowedBooks.filter(b => b.id !== id);
  localStorage.setItem("borrowedBooks_" + user, JSON.stringify(borrowedBooks));
  localStorage.setItem("availableBooks", JSON.stringify(available));
  updateBorrowableCount();

  if (fine > 0) {
    const payments = JSON.parse(localStorage.getItem("payments_" + user) || "[]");
    payments.push({
      title: returned.title,
      author: returned.author,
      cover: returned.cover,
      fine,
      status: "Unpaid",
      daysOverdue: overdueDays,
      returnDate: now.toISOString()
    });
    localStorage.setItem("payments_" + user, JSON.stringify(payments));
    alert(`"${returned.title}" returned late.\nPenalty: ₱${fine} (${overdueDays} day${overdueDays > 1 ? "s" : ""} overdue).`);
  } else {
    alert(`"${returned.title}" returned successfully!`);
  }

  location.reload();
}

/* ----------------------------------------------------------
   Report Lost Book
---------------------------------------------------------- */
function reportLostBook(id) {
  const user = getCurrentUser();
  let borrowedBooks = JSON.parse(localStorage.getItem("borrowedBooks_" + user) || "[]");
  let payments = JSON.parse(localStorage.getItem("payments_" + user) || "[]");

  const lostBook = borrowedBooks.find(b => b.id === id);
  if (!lostBook) {
    alert("Book not found.");
    return;
  }

  // Use the book's own price or a default fallback
  const bookPrice = lostBook.price || Math.floor(Math.random() * 901) + 100;

  if (confirm(`Report "${lostBook.title}" as lost?\nYou may replace the book with the same copy instead of paying ₱${bookPrice}.`)) {
    payments.push({
      title: lostBook.title,
      author: lostBook.author,
      cover: lostBook.cover,
      fine: bookPrice,
      status: "Unpaid",
      daysOverdue: 0,
      note: "Lost Book"
    });

    borrowedBooks = borrowedBooks.filter(b => b.id !== id);
    localStorage.setItem("borrowedBooks_" + user, JSON.stringify(borrowedBooks));
    localStorage.setItem("payments_" + user, JSON.stringify(payments));

    alert(`"${lostBook.title}" has been reported as lost.\nYou can either pay ₱${bookPrice} or replace it with the same copy.`);
    location.reload();
  }
}

/* ----------------------------------------------------------
   Renew Book
---------------------------------------------------------- */
function renewBook(id) {
  const user = getCurrentUser();
  const borrowed = JSON.parse(localStorage.getItem("borrowedBooks_" + user) || "[]");
  const book = borrowed.find(b => b.id === id);

  if (!book) return;
  if (book.renewed) {
    alert("You can only renew a book once.");
    return;
  }

  const newDue = new Date(book.dueDate);
  newDue.setDate(newDue.getDate() + BORROW_DAYS);
  book.dueDate = newDue.toISOString();
  book.renewed = true;

  localStorage.setItem("borrowedBooks_" + user, JSON.stringify(borrowed));
  alert(`${book.title} renewed for another ${BORROW_DAYS} days!`);
  location.reload();
}

/* ----------------------------------------------------------
   Simulate Days Passing
---------------------------------------------------------- */
function simulateReduceDays(id, days) {
  const user = getCurrentUser();
  const borrowed = JSON.parse(localStorage.getItem("borrowedBooks_" + user) || "[]");
  const book = borrowed.find(b => b.id === id);
  if (!book) return alert("Book not found.");

  const newDue = new Date(book.dueDate);
  newDue.setDate(newDue.getDate() - days);
  book.dueDate = newDue.toISOString();

  localStorage.setItem("borrowedBooks_" + user, JSON.stringify(borrowed));
  alert(`Simulated -${days} day(s) for "${book.title}".`);
  location.reload();
}

/* ----------------------------------------------------------
   Update Borrowable Count
---------------------------------------------------------- */
function updateBorrowableCount() {
  const user = getCurrentUser();
  const borrowedBooks = JSON.parse(localStorage.getItem("borrowedBooks_" + user) || "[]");
  const availableSlots = BORROW_LIMIT - borrowedBooks.length;

  const bookCountLabel = document.getElementById("bookCount");
  if (bookCountLabel) bookCountLabel.textContent = availableSlots;
}

/* ----------------------------------------------------------
   Render Available Books
---------------------------------------------------------- */
function renderAvailableBooks() {
  const container = document.getElementById("availableBooksContainer");
  if (!container) return;

  const available = JSON.parse(localStorage.getItem("availableBooks") || "[]");
  const user = getCurrentUser();
  const borrowed = JSON.parse(localStorage.getItem("borrowedBooks_" + user) || "[]");

  const remainingSlots = Math.max(0, BORROW_LIMIT - borrowed.length);
  const bookCountEl = document.getElementById("bookCount");
  if (bookCountEl) bookCountEl.textContent = remainingSlots;

  container.innerHTML = "";
  available.forEach(book => {
    const card = document.createElement("div");
    card.classList.add("book-card");
    card.innerHTML = `
      <div class="book-cover-container">
        <img src="${book.cover}" alt="${book.title}">
      </div>
      <div class="book-info">
        <h3 title="${book.title}">${book.title}</h3>
        <h6 title="${book.author}">${book.author}</h6>
        <button ${remainingSlots === 0 ? "disabled" : ""} onclick="borrowBook(${book.id})">Borrow</button>
      </div>

    `;
    container.appendChild(card);
  });
}

/* ----------------------------------------------------------
   Render My Books
---------------------------------------------------------- */
function renderMyBooks() {
  const container = document.getElementById("myBooksContainer");
  if (!container) return;

  const user = getCurrentUser();
  const books = JSON.parse(localStorage.getItem("borrowedBooks_" + user) || "[]");

  if (books.length === 0) {
    container.innerHTML = "<h4>No books borrowed yet.</h4>";
    return;
  }

  container.innerHTML = books.map(book => {
    const borrowDate = new Date(book.borrowDate).toLocaleDateString();
    const dueDate = new Date(book.dueDate).toLocaleDateString();
    const overdue = new Date() > new Date(book.dueDate);

    return `
      <div class="book-card">
        <img src="${book.cover}" alt="${book.title}">
        <h3>${book.title}</h3>
        <h6>${book.author}</h6>
        <p><strong>Borrowed:</strong> ${borrowDate}</p>
        <p><strong>Due:</strong> ${dueDate}</p>
        <p style="color:${overdue ? 'red' : 'green'};">
          <strong>Status:</strong> ${overdue ? 'Overdue' : 'On Time'}
        </p>
        <div class="book-buttons">
          <button onclick="returnBook(${book.id})">Return</button>
          <button onclick="renewBook(${book.id})" ${book.renewed ? "disabled" : ""}>Renew</button>
          <button onclick="reportLostBook(${book.id})" class="lost-btn">Lost</button>
        </div>
        <div class="simulate-buttons">
          <button onclick="simulateReduceDays(${book.id}, 1)">-1 Day</button>
          <button onclick="simulateReduceDays(${book.id}, 7)">-7 Days</button>
        </div>
      </div>
    `;
  }).join("");
}

/* ----------------------------------------------------------
   Render Payments
---------------------------------------------------------- */
function renderPayments() {
  const container = document.getElementById("paymentList");
  if (!container) return;

  const user = getCurrentUser();
  const payments = JSON.parse(localStorage.getItem("payments_" + user) || "[]");

  if (payments.length === 0) {
    container.innerHTML = "<h4>No payments yet.</h4>";
    return;
  }

  container.innerHTML = payments.map((p, index) => {
    let actionButton = "";

    if (p.status === "Unpaid") {
      if (p.note === "Lost Book") {
        actionButton = `
          <div class="lost-actions">
            <button class="pay-balance-btn" onclick="payBalance(${index})">Pay ₱${p.fine}</button>
            <button class="replace-btn" onclick="replaceBook(${index})">Replace Book</button>
          </div>
        `;
      } else {
        actionButton = `<button class="pay-balance-btn" onclick="payBalance(${index})">Pay Balance</button>`;
      }
    }

    return `
      <div class="child-container">
        <div class="book-container">
          <img src="${p.cover}" alt="${p.title}">
        </div>
        <div class="bookinfo-container">
          <h2>${p.title}</h2>
          <p>${p.author}</p>
          <div class="${p.status === "Paid" ? "state" : "state2"}">
            <p>${p.status}</p>
          </div>
        </div>
        <div class="balance-container">
          <h2>${p.note === "Lost Book" ? "Lost Book Fine" : "Penalty"}</h2>
          <p>${p.note === "Lost Book" ? "Replacement or Payment Required" : `No. of overdue: ${p.daysOverdue || 0} day(s)`}</p>
          <h1>₱${p.fine}</h1>
          ${actionButton}
        </div>
      </div>
    `;
  }).join("") + `
    <div class="remove-all-container">
      <button class="remove-all-btn" onclick="removeAllPaidBooks()">Remove All Paid Books</button>
    </div>
  `;
}

/* ----------------------------------------------------------
   Replace Lost Book — user chooses to replace instead of paying
---------------------------------------------------------- */
function replaceBook(index) {
  const user = getCurrentUser();
  let payments = JSON.parse(localStorage.getItem("payments_" + user) || "[]");
  let availableBooks = JSON.parse(localStorage.getItem("availableBooks") || "[]");

  if (!payments[index]) return;

  const book = payments[index];

  if (confirm(`Confirm that "${book.title}" has been replaced with the same copy? This will clear the fine and return the book to the available list.`)) {
    // Mark the payment as settled
    payments[index].status = "Paid";
    payments[index].note = "Replaced by User";

    // Restore the book back to the shared available books
    availableBooks.push({
      id: Date.now(), // new unique ID (avoid duplicate)
      title: book.title,
      author: book.author,
      cover: book.cover,
      price: book.price || Math.floor(Math.random() * 901) + 100
    });

    // Save updates
    localStorage.setItem("availableBooks", JSON.stringify(availableBooks));
    localStorage.setItem("payments_" + user, JSON.stringify(payments));

    alert(`✅ "${book.title}" has been successfully replaced and added back to the library.`);
    renderPayments();
  }
}



/* ----------------------------------------------------------
   Pay Individual Balance
---------------------------------------------------------- */
function payBalance(index) {
  const user = getCurrentUser();
  let payments = JSON.parse(localStorage.getItem("payments_" + user) || "[]");

  if (!payments[index]) return;
  if (payments[index].status === "Paid") {
    alert("This balance is already paid.");
    return;
  }

  if (confirm(`Confirm payment of ₱${payments[index].fine} for "${payments[index].title}"?`)) {
    payments[index].status = "Paid";
    localStorage.setItem("payments_" + user, JSON.stringify(payments));
    alert(`Payment successful! "${payments[index].title}" marked as Paid.`);
    renderPayments();
  }
}

/* ----------------------------------------------------------
   View Payment History (shows all Paid transactions)
---------------------------------------------------------- */
function showPaymentHistory() {
  const user = getCurrentUser();
  const archivedContainer = document.getElementById("archivedPaymentsSection");
  if (!archivedContainer) return;

  const payments = JSON.parse(localStorage.getItem("payments_" + user) || "[]");
  const paidPayments = payments.filter(p => p.status === "Paid");

  archivedContainer.innerHTML = ""; // clear previous content

  if (paidPayments.length === 0) {
    archivedContainer.innerHTML = `<p style="text-align:center; color:#666; margin-top:10px;">No payment history found.</p>`;
    return; 
  }

  // Section title
  const title = document.createElement("h2");
  title.textContent = "Payment History";
  title.style.textAlign = "center";
  title.style.margin = "25px 0 15px 0";
  title.style.color = "#2D3967";
  archivedContainer.appendChild(title);

  // Display paid items
  paidPayments.forEach(p => {
    const div = document.createElement("div");
    div.classList.add("child-container");
    div.style.opacity = "0.9";
    div.style.background = "#f6f6f6"; // slightly lighter to show it’s history
    div.innerHTML = `
      <div class="book-container"><img src="${p.cover}" alt="${p.title}"></div>
      <div class="bookinfo-container">
        <h2>${p.title}</h2>
        <p>${p.author}</p>
        <div class="state"><p>${p.status}</p></div>
      </div>
      <div class="balance-container">
        <h2>Penalty Paid</h2>
        <p>Overdue: ${p.daysOverdue || 0} day(s)</p>
        <h1>₱${p.fine}</h1>
        <p style="font-size:12px; color:#555;">Paid on: ${new Date(p.returnDate).toLocaleDateString()}</p>
      </div>
    `;
    archivedContainer.appendChild(div);
  });
}


/* ----------------------------------------------------------
   Remove All Paid Books
---------------------------------------------------------- */
function removeAllPaidBooks() {
  const user = getCurrentUser();
  const payments = JSON.parse(localStorage.getItem("payments_" + user) || "[]");

  if (!payments.some(p => p.status === "Paid")) {
    alert("No paid books to archive.");
    return;
  }

  if (confirm("Archive all paid records instead of deleting?")) {
    const paidRecords = payments.filter(p => p.status === "Paid");
    const unpaidRecords = payments.filter(p => p.status !== "Paid");

    // Keep an archive of paid payments
    const archived = JSON.parse(localStorage.getItem("archivedPayments_" + user) || "[]");
    const updatedArchive = [...archived, ...paidRecords];
    localStorage.setItem("archivedPayments_" + user, JSON.stringify(updatedArchive));

    // Keep only unpaid in the main list
    localStorage.setItem("payments_" + user, JSON.stringify(unpaidRecords));

    alert("All paid records moved to history successfully!");
    renderPayments();
  }
}
/* ==========================================================
   DYNAMIC USER PROFILE PICTURE
   ========================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const currentUser = localStorage.getItem("currentUser") || "Guest";
  const profilePic = document.getElementById("userProfilePic");

  const userProfiles = {
    Dean: "/images/user/Dean.jpg",
    Heurie: "/images/user/heurie.jpg",
    Peneil: "/images/user/Pen.jpg",
    Guest: "/images/user/default.jpg"
  };

  if (profilePic) {
    profilePic.src = userProfiles[currentUser] || userProfiles["Guest"];
    profilePic.alt = `${currentUser}'s Profile Picture`;
  } else {
    console.warn("Profile picture element not found.");
  }

  console.log("Current user:", currentUser);
  console.log("Profile image path:", userProfiles[currentUser]);
});

    function goBack() {
      localStorage.removeItem("currentUser");
      window.location.href = "/index.html";
    }

/* ----------------------------------------------------------
   Toggle Payment History Section
---------------------------------------------------------- */
function togglePaymentHistory() {
  const user = getCurrentUser();
  const archivedContainer = document.getElementById("archivedPaymentsContainer");
  const button = document.querySelector(".view-history-btn");

  // Get all paid payments
  const payments = JSON.parse(localStorage.getItem("payments_" + user) || "[]");
  const paidPayments = payments.filter(p => p.status === "Paid");

  // If empty
  if (paidPayments.length === 0) {
    archivedContainer.innerHTML = `<p class="no-history">No payment history found.</p>`;
  } else {
    archivedContainer.innerHTML = `
      <h3>Payment History</h3>
      ${paidPayments
        .map(
          (p) => `
        <div class="archived-item">
          <img src="${p.cover}" alt="${p.title}">
          <div class="archived-info">
            <h4>${p.title}</h4>
            <p>${p.author}</p>
            <p>Penalty Paid: ₱${p.fine}</p>
            <p>Overdue: ${p.daysOverdue || 0} day(s)</p>
            <p><small>Returned: ${new Date(p.returnDate).toLocaleDateString()}</small></p>
          </div>
        </div>
      `
        )
        .join("")}
    `;
  }

  // Toggle visibility
  if (archivedContainer.classList.contains("hidden")) {
    archivedContainer.classList.remove("hidden");
    archivedContainer.style.display = "block";
    button.textContent = "Hide Payment History";
  } else {
    archivedContainer.classList.add("hidden");
    archivedContainer.style.display = "none";
    button.textContent = "View Payment History";
  }
}
/* ----------------------------------------------------------
   Run on Load
---------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initializeBooks();
  renderAvailableBooks();
  renderMyBooks();
  renderPayments();
  updateBorrowableCount();
});

/* ==========================================================
   SMOOTH PAGE TRANSITION EFFECT
   Applies to all pages automatically
========================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Fade in when the page loads
  document.body.classList.add("fade-in");

  // Handle fade-out before navigation
  document.querySelectorAll("a[href]").forEach(link => {
    link.addEventListener("click", e => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

      e.preventDefault();
      document.body.classList.remove("fade-in");
      document.body.style.opacity = 0;

      setTimeout(() => {
        window.location.href = href;
      }, 300); // wait for fade-out animation
    });
  });
});

