/**
 * main.js
 * Logic for Moa's Birthday Cafe web application
 */

document.addEventListener('DOMContentLoaded', () => {

    /* --- Page Entry Logic --- */
    const enterBtn = document.getElementById('enter-btn');
    const introPage = document.getElementById('intro-page');
    const mainPage = document.getElementById('main-page');

    enterBtn.addEventListener('click', () => {
        introPage.classList.add('hidden');
        introPage.classList.remove('active');
        mainPage.classList.remove('hidden');
        mainPage.classList.add('active');
        mainPage.classList.add('fade-in'); // Add animation class
    });

    /* --- Navigation Logic --- */
    const navButtons = document.querySelectorAll('.nav-btn');
    const contentSections = document.querySelectorAll('.content-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes from all buttons
            navButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');

            // Hide all sections
            contentSections.forEach(section => {
                section.classList.add('hidden');
                section.classList.remove('active', 'fade-in');
            });

            // Show target section
            const targetId = btn.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                targetSection.classList.remove('hidden');
                targetSection.classList.add('active', 'fade-in'); // Add fade-in for smooth transition
            }
        });
    });

    /* --- SNS Footer Logic --- */
    const snsButtons = document.querySelectorAll('.sns-btn');

    snsButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior if wrapped in <a>
            const snsName = btn.getAttribute('data-sns');
            alert(`[${snsName}] 기능은 준비중입니다.`);
        });
    });

    /* --- Modal Close Logic --- */
    const modal = document.getElementById('image-modal');
    const closeBtn = document.querySelector('.close-modal');

    // Close on 'X' click
    closeBtn.addEventListener('click', () => {
        closeModal();
    });

    // Close on background click
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Close on Escape key press
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });
});

/* --- Gallery Modal Functions (Global scope for onclick attributes) --- */
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalAuthor = document.getElementById('modal-author');
const modalDesc = document.getElementById('modal-desc');

// Function called by inline onclick in HTML
window.openModal = function(imageSrc, authorName, descriptionText) {
    if(!modal) return;
    
    modalImg.src = imageSrc;
    modalImg.alt = `Fanart by ${authorName}`;
    modalAuthor.textContent = `Artist: ${authorName}`;
    modalDesc.textContent = descriptionText;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

window.closeModal = function() {
    if(!modal) return;
    modal.style.display = 'none';
    modalImg.src = ''; // Clear source
    document.body.style.overflow = 'auto'; // Restore background scrolling
};
