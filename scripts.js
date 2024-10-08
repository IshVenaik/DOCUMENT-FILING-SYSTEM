let editingDocumentId = null;

// Remove any existing event listeners
const form = document.getElementById('document-form');
const newForm = form.cloneNode(true);
form.parentNode.replaceChild(newForm, form);

// Add a single event listener for form submission
document.getElementById('document-form').addEventListener('submit', function (event) {
    event.preventDefault();
    console.log('Form submitted');

    const formData = new FormData(this);
    
    const url = editingDocumentId ? `/api/documents/${editingDocumentId}` : '/api/documents';
    const method = editingDocumentId ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw err; });
        }
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        loadAndDisplayDocuments();
        resetForm();
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('Error: ' + (error.error || 'An unknown error occurred'));
    });
});

function loadAndDisplayDocuments() {
    fetch('/api/documents')
        .then(response => response.json())
        .then(documents => {
            displayDocuments(documents);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

function displayDocuments(docs) {
    const tbody = document.querySelector('#document-table tbody');
    tbody.innerHTML = '';
    console.log('Displaying documents in this order:');
    docs.forEach((doc, index) => {
        console.log(`${index + 1}. Serial: ${doc.serialNumber}, Reference: ${doc.referenceID}`);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${doc.serialNumber || ''}</td>
            <td>${doc.referenceID || ''}</td>
            <td>${doc.dateOfDocument || ''}</td>
            <td>${doc.subject || ''}</td>
            <td>${doc.fromEntity || ''}</td>
            <td>${doc.toEntity || ''}</td>
            <td>${doc.pdfPath ? `<a href="${doc.pdfPath}" target="_blank">View PDF</a>` : 'No PDF'}</td>
            <td>${doc.actionPdfPath ? `<a href="${doc.actionPdfPath}" target="_blank">View Action PDF</a>` : 'No Action PDF'}</td>
            <td>${doc.actions || ''}</td>
            <td>${doc.deadlineDate || ''}</td>
            <td>
                <div class="action-buttons">
                    <button class="edit" onclick="editDocument(${doc.serialNumber})">Edit</button>
                    <button class="delete" onclick="deleteDocument(${doc.serialNumber})">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editDocument(serialNumber) {
    console.log('Editing document:', serialNumber);
    editingDocumentId = serialNumber;
    fetch(`/api/documents/${serialNumber}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch document');
            }
            return response.json();
        })
        .then(doc => {
            if (doc) {
                console.log('Document fetched:', doc);
                document.getElementById('referenceID').value = doc.referenceID || '';
                document.getElementById('subject').value = doc.subject || '';
                document.getElementById('fromEntity').value = doc.fromEntity || '';
                document.getElementById('toEntity').value = doc.toEntity || '';
                document.getElementById('actions').value = doc.actions || '';
                document.getElementById('deadlineDate').value = doc.deadlineDate || '';

                // Change the form submission button text
                document.querySelector('#document-form button[type="submit"]').textContent = 'Update Document';

                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });

                document.getElementById('referenceID').focus();
            }
        })
        .catch((error) => {
            console.error('Error fetching document for edit:', error);
            alert('Error fetching document for edit: ' + error.message);
        });
}

function deleteDocument(serialNumber) {
    if (confirm('Are you sure you want to delete this document?')) {
        fetch(`/api/documents/${serialNumber}`, {
            method: 'DELETE',
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            loadAndDisplayDocuments();  // Refresh the document list
        })
        .catch((error) => {
            console.error('Error deleting document:', error);
            alert('Error deleting document: ' + (error.error || error.message || 'An unknown error occurred'));
        });
    }
}

function resetForm() {
    document.getElementById('document-form').reset();
    editingDocumentId = null;
    document.querySelector('#document-form button[type="submit"]').textContent = 'Submit Document';
}

document.getElementById('cancelEdit').addEventListener('click', resetForm);

document.getElementById('searchButton').addEventListener('click', function() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    fetch('/api/documents')
        .then(response => response.json())
        .then(documents => {
            const filteredDocs = documents.filter(doc => 
                doc.referenceID.toLowerCase().includes(searchTerm) ||
                doc.subject.toLowerCase().includes(searchTerm) ||
                doc.fromEntity.toLowerCase().includes(searchTerm) ||
                doc.toEntity.toLowerCase().includes(searchTerm)
            );
            displayDocuments(filteredDocs);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
});

// Call this function when the page loads to display any existing documents
loadAndDisplayDocuments();

// Add this at the end of the file
document.getElementById('exportButton').addEventListener('click', function() {
    window.location.href = '/api/export';
});