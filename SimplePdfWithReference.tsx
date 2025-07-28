import React from 'react';
import TestPDF from '@nyazkhan/react-pdf-viewer/TestPDF'; // Import the TestPDF component we created
import { Box } from '@mui/material';

const SimplePdfWithReference = ({ fileUrl, referenceText, pageNumber = 1 }) => {
  return (
    <Box sx={{ height: '90vh', width: '100%' }}>
      <TestPDF
        pageNumber={pageNumber}
        referenceText={referenceText}
        fileUrl={fileUrl}
      />
    </Box>
  );
};

export default SimplePdfWithReference; 