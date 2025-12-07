import os
import json
import base64
from typing import Dict, List, Optional
import openai
from pdfminer.high_level import extract_text
from docx import Document
import PyPDF2
from PIL import Image
import cv2
import numpy as np
from deepface import DeepFace
import google.generativeai as genai
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as ReportLabImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import io

class CVAnalyzer:
    def __init__(self):
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
        self.openai.api_key = self.openai_api_key
        genai.configure(api_key=self.gemini_api_key)
        
    def extract_text_from_file(self, file_path: str) -> str:
        """Extract text from various file formats"""
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.pdf':
            return self._extract_from_pdf(file_path)
        elif ext == '.docx':
            return self._extract_from_docx(file_path)
        elif ext == '.txt':
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            raise ValueError(f"Unsupported file format: {ext}")
    
    def _extract_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file"""
        try:
            text = extract_text(file_path)
            return text
        except:
            # Fallback method
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text()
                return text
    
    def _extract_from_docx(self, file_path: str) -> str:
        """Extract text from DOCX file"""
        doc = Document(file_path)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text
    
    def analyze_cv_structure(self, cv_text: str) -> Dict:
        """Analyze CV structure and extract sections"""
        prompt = f"""
        Analyze this CV and extract the following information in JSON format:
        1. Personal Information (name, contact details)
        2. Professional Summary
        3. Work Experience (company, position, duration, responsibilities)
        4. Education (institution, degree, year)
        5. Skills (technical, soft skills)
        6. Certifications
        7. Languages
        
        CV Content:
        {cv_text[:4000]}
        
        Return only valid JSON.
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a CV analysis expert. Extract structured information from CVs."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        
        return json.loads(response.choices[0].message.content)
    
    def verify_photo(self, photo_path: str) -> Dict:
        """Verify profile photo meets requirements"""
        try:
            # Load image
            img = cv2.imread(photo_path)
            if img is None:
                return {"valid": False, "error": "Cannot read image file"}
            
            # Check dimensions
            height, width = img.shape[:2]
            if width < 300 or height < 300:
                return {"valid": False, "error": "Image too small. Minimum 300x300 required"}
            
            # Check aspect ratio (should be close to square)
            aspect_ratio = width / height
            if aspect_ratio < 0.8 or aspect_ratio > 1.2:
                return {"valid": False, "error": "Image should be square (1:1 aspect ratio)"}
            
            # Check if it's a head and shoulders photo using face detection
            face_analysis = DeepFace.analyze(
                img_path=photo_path,
                actions=['age', 'gender', 'race', 'emotion'],
                enforce_detection=True,
                detector_backend='opencv',
                silent=True
            )
            
            if len(face_analysis) == 0:
                return {"valid": False, "error": "No face detected. Please upload a head and shoulders photo"}
            
            # Check if face occupies appropriate portion of image
            face_region = face_analysis[0]['region']
            face_area = face_region['w'] * face_region['h']
            image_area = width * height
            
            face_ratio = face_area / image_area
            if face_ratio < 0.1 or face_ratio > 0.5:
                return {"valid": False, "error": "Face too small or too large. Please ensure head and shoulders are visible"}
            
            # Check image quality
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            if laplacian_var < 100:
                return {"valid": False, "error": "Image blurry. Please upload a clear photo"}
            
            return {
                "valid": True,
                "dimensions": {"width": width, "height": height},
                "face_detected": True,
                "face_count": len(face_analysis),
                "image_quality": "good" if laplacian_var > 200 else "acceptable",
                "recommendation": "Photo meets requirements"
            }
            
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    def enhance_cv(self, cv_data: Dict, personal_info: Dict, qualifications: List) -> Dict:
        """Enhance CV using AI"""
        prompt = f"""
        Rewrite and enhance this CV for the South African job market.
        
        Original CV Structure:
        {json.dumps(cv_data, indent=2)}
        
        Personal Information:
        {json.dumps(personal_info, indent=2)}
        
        Qualifications:
        {json.dumps(qualifications, indent=2)}
        
        Requirements:
        1. Use professional South African CV format
        2. Highlight achievements with metrics
        3. Optimize for ATS (Applicant Tracking Systems)
        4. Include keywords for target industries
        5. Add professional summary tailored to South African market
        6. Format for easy readability
        7. Include all provided qualifications
        8. Add section for references (available on request)
        
        Return the enhanced CV in plain text with clear section headers.
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a professional CV writer specializing in South African job market."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=3000
        )
        
        enhanced_cv = response.choices[0].message.content
        
        # Generate PDF version
        pdf_path = self._create_cv_pdf(enhanced_cv, personal_info)
        
        return {
            "content": enhanced_cv,
            "pdf_url": pdf_path,
            "word_count": len(enhanced_cv.split()),
            "enhancements": [
                "ATS optimized",
                "Achievement-focused",
                "SA market tailored",
                "Professional formatting"
            ]
        }
    
    def _create_cv_pdf(self, cv_content: str, personal_info: Dict) -> str:
        """Create PDF from CV content"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Custom styles
        styles.add(ParagraphStyle(
            name='Heading1',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=12
        ))
        
        styles.add(ParagraphStyle(
            name='BodyText',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=6
        ))
        
        # Build PDF content
        story = []
        
        # Add name as title
        name = f"{personal_info.get('firstName', '')} {personal_info.get('lastName', '')}"
        story.append(Paragraph(name.upper(), styles['Heading1']))
        story.append(Spacer(1, 12))
        
        # Add contact info
        contact_info = f"""
        {personal_info.get('email', '')} | {personal_info.get('phone', '')}
        """
        story.append(Paragraph(contact_info, styles['BodyText']))
        story.append(Spacer(1, 24))
        
        # Add CV content
        for line in cv_content.split('\n'):
            if line.strip():
                if line.strip().endswith(':'):
                    # Section header
                    story.append(Paragraph(line.strip(), styles['Heading2']))
                else:
                    # Body text
                    story.append(Paragraph(line.strip(), styles['BodyText']))
        
        # Generate PDF
        doc.build(story)
        buffer.seek(0)
        
        # Save to file (in production, save to cloud storage)
        pdf_filename = f"enhanced_cv_{personal_info.get('idNumber', 'temp')}.pdf"
        pdf_path = f"/tmp/{pdf_filename}"
        
        with open(pdf_path, 'wb') as f:
            f.write(buffer.getvalue())
        
        return pdf_path
    
    def generate_cover_letter(self, personal_info: Dict, cv_data: Dict, job_description: Optional[str] = None) -> Dict:
        """Generate personalized cover letter"""
        if job_description:
            prompt = f"""
            Write a professional cover letter for a South African job application.
            
            Applicant: {personal_info.get('firstName')} {personal_info.get('lastName')}
            CV Highlights: {json.dumps(cv_data.get('highlights', []))}
            
            Job Description:
            {job_description[:2000]}
            
            Requirements:
            1. Address to "Dear Hiring Manager"
            2. Highlight relevant experience from CV
            3. Match skills to job requirements
            4. Show enthusiasm for position
            5. Keep to one page
            6. Professional closing
            7. South African business format
            """
        else:
            prompt = f"""
            Write a generic but professional cover letter template for {personal_info.get('firstName')} {personal_info.get('lastName')}.
            
            CV Highlights: {json.dumps(cv_data.get('highlights', []))}
            
            Requirements:
            1. Address to "Dear Hiring Manager"
            2. Highlight key skills and experience
            3. Professional and adaptable tone
            4. Keep to one page
            5. South African business format
            """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a professional cover letter writer for South African job market."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            max_tokens=1500
        )
        
        cover_letter = response.choices[0].message.content
        
        return {
            "content": cover_letter,
            "type": "job_specific" if job_description else "generic",
            "word_count": len(cover_letter.split())
        }

# Usage example
if __name__ == "__main__":
    analyzer = CVAnalyzer()
    
    # Example usage
    cv_text = analyzer.extract_text_from_file("sample_cv.pdf")
    cv_structure = analyzer.analyze_cv_structure(cv_text)
    
    personal_info = {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phone": "+27721234567"
    }
    
    enhanced_cv = analyzer.enhance_cv(cv_structure, personal_info, [])
    print(enhanced_cv["content"])
