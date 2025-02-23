function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function generatePDF(data) {
  if (!data.entries || !Array.isArray(data.entries) || data.entries.length === 0) {
    Logger.log("Error: No entries data received.");
    return;
  }

  var templateId = "14xPYnKg2fU07kTcma0t_mFjmwWXN6jIkdpj21JfCtQ8";
  var folder = DriveApp.getFolderById("1RnFjY4y-Eus2SgcZXXMrTSwif4hypGFV");
  var pdfFiles = [];

  data.entries.forEach(function(entry) {
    var docCopy = DriveApp.getFileById(templateId).makeCopy(folder);
    var doc = DocumentApp.openById(docCopy.getId());
    var body = doc.getBody();

    body.replaceText('<Name>', entry.name || '');
    body.replaceText('<PEN>', entry.pen || '');
    body.replaceText('<Subject>', entry.subject || '');
    body.replaceText('<Term>', entry.term || '');
    body.replaceText('<Semester>', entry.semester || '');
    body.replaceText('<Class>', entry.className || '');
    body.replaceText('<Batch>', entry.batch || '');
    body.replaceText('<CheckedBy>', entry.checkedBy || '');
    body.replaceText('<PracticalNumber>', entry.practicalNumber || '');
    body.replaceText('<ExperimentName>', entry.experimentName || '');

    doc.saveAndClose();

    var pdf = docCopy.getAs('application/pdf');
    var pdfFile = folder.createFile(pdf);
    pdfFiles.push(pdfFile.getId());
  });

  // Fix: Properly handle the promise from mergePDFs
  mergePDFs(pdfFiles).then(mergedPdfId => {
    if (mergedPdfId) {
      Logger.log("Merged PDF ID: " + mergedPdfId);
      sendEmailWithPDF(data.email, mergedPdfId);
    } else {
      Logger.log("Merging failed, no file to send.");
    }
  }).catch(error => {
    Logger.log("Error merging PDFs: " + error);
  });
}

function mergePDFs(fileIds) {
  if (!fileIds || fileIds.length === 0) {
    Logger.log("Error: No PDF files to merge.");
    return Promise.resolve(null);
  }

  var pdfBlobs = fileIds.map(id => extractSecondPage(DriveApp.getFileById(id)));

  return Promise.all(pdfBlobs) // Wait for all extraction operations
    .then(filteredBlobs => {
      filteredBlobs = filteredBlobs.filter(blob => blob !== null); // Remove any null values

      if (filteredBlobs.length === 0) {
        Logger.log("Error: No valid PDF pages extracted.");
        return null;
      }

      return PDFApp.mergePDFs(filteredBlobs);
    })
    .then(newBlob => {
      if (!newBlob) return null;

      var mergedFile = DriveApp.getFolderById("1RnFjY4y-Eus2SgcZXXMrTSwif4hypGFV").createFile(newBlob);
      return mergedFile.getId();
    })
    .catch(err => {
      Logger.log("Error merging PDFs: " + err);
      return null;
    });
}

// Function to extract only the second page of a PDF
function extractSecondPage(file) {
  return PDFApp.setPDFBlob(file.getBlob()).splitPDF()
    .then(blobs => {
      if (blobs.length > 1) {
        return blobs[1]; // Take only the second page
      }
      return null;
    })
    .catch(err => {
      Logger.log("Error extracting second page: " + err);
      return null;
    });
}

function sendEmailWithPDF(email, fileId) {
  try {
    var file = DriveApp.getFileById(fileId); // Ensure this gets a valid file ID
    if (!file) {
      Logger.log("File not found!");
      return;
    }

    var blob = file.getBlob();
    GmailApp.sendEmail(email, "Your Generated Term Work PDF", "Please find your Term Work PDF attached.", {
      attachments: [blob]
    });

    Logger.log("Email sent successfully to: " + email);
  } catch (e) {
    Logger.log("Error sending email: " + e.toString());
  }
}
