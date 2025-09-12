import os
import httpx
from typing import List, Dict, Optional
from urllib.parse import urlencode
import json


class ProcoreClient:
    def __init__(self):
        self.client_id = os.getenv("PROCORE_CLIENT_ID", "RFLeKXReUoqaHmIX6nCSOJ_FCZeBt6GU1WH9hT0ltDc")
        self.client_secret = os.getenv("PROCORE_CLIENT_SECRET", "lJaoBeu4FrbKb_CuGiqJkUQveLxT7uhS-y8dYMlczdI")
        self.api_base_url = os.getenv("PROCORE_API_BASE_URL", "https://sandbox.procore.com")
        self.auth_base_url = os.getenv("PROCORE_AUTH_BASE_URL", "https://login-sandbox.procore.com")
        self.company_id = os.getenv("PROCORE_COMPANY_ID", "4276435")
        self.redirect_uri = os.getenv("PROCORE_REDIRECT_URI", "http://localhost:3001/auth/callback")
        self.access_token = None
        self.refresh_token = None
        
    def get_authorization_url(self) -> str:
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": "read write"
        }
        return f"{self.auth_base_url}/oauth/authorize?{urlencode(params)}"
    
    def exchange_code_for_token(self, code: str) -> Dict:
        url = f"{self.auth_base_url}/oauth/token"
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri
        }
        
        with httpx.Client() as client:
            response = client.post(url, data=data)
            response.raise_for_status()
            token_data = response.json()
            
            self.access_token = token_data.get("access_token")
            self.refresh_token = token_data.get("refresh_token")
            
            return token_data
    
    def refresh_access_token(self) -> Dict:
        if not self.refresh_token:
            raise ValueError("No refresh token available")
        
        url = f"{self.auth_base_url}/oauth/token"
        data = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        with httpx.Client() as client:
            response = client.post(url, data=data)
            response.raise_for_status()
            token_data = response.json()
            
            self.access_token = token_data.get("access_token")
            if token_data.get("refresh_token"):
                self.refresh_token = token_data.get("refresh_token")
            
            return token_data
    
    def set_tokens(self, access_token: str, refresh_token: Optional[str] = None):
        self.access_token = access_token
        if refresh_token:
            self.refresh_token = refresh_token
    
    def _get_headers(self) -> Dict:
        if not self.access_token:
            raise ValueError("Access token not set. Please authenticate first.")
        
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Procore-Company-Id": self.company_id,
            "Accept": "application/json"
        }
    
    def list_projects(self) -> List[Dict]:
        url = f"{self.api_base_url}/rest/v1.0/companies/{self.company_id}/projects"
        
        with httpx.Client() as client:
            response = client.get(url, headers=self._get_headers())
            response.raise_for_status()
            return response.json()
    
    def list_drawings(self, project_id: str) -> List[Dict]:
        url = f"{self.api_base_url}/rest/v1.0/projects/{project_id}/drawings"
        
        with httpx.Client() as client:
            response = client.get(url, headers=self._get_headers())
            response.raise_for_status()
            return response.json()
    
    def get_drawing(self, project_id: str, drawing_id: str) -> Dict:
        url = f"{self.api_base_url}/rest/v1.0/projects/{project_id}/drawings/{drawing_id}"
        
        with httpx.Client() as client:
            response = client.get(url, headers=self._get_headers())
            response.raise_for_status()
            return response.json()
    
    def download_drawing(self, project_id: str, drawing_id: str, output_path: str) -> str:
        drawing = self.get_drawing(project_id, drawing_id)
        
        if not drawing.get("current_revision"):
            raise ValueError(f"Drawing {drawing_id} has no current revision")
        
        download_url = drawing["current_revision"].get("download_url")
        if not download_url:
            raise ValueError(f"Drawing {drawing_id} has no download URL")
        
        with httpx.Client() as client:
            response = client.get(download_url, headers=self._get_headers(), follow_redirects=True)
            response.raise_for_status()
            
            with open(output_path, "wb") as f:
                f.write(response.content)
        
        return output_path
    
    def filter_m_series_drawings(self, drawings: List[Dict]) -> List[Dict]:
        m_series = []
        for drawing in drawings:
            discipline = drawing.get("discipline", {})
            if isinstance(discipline, dict):
                name = discipline.get("name", "")
                if name.upper().startswith("M"):
                    m_series.append(drawing)
            elif isinstance(discipline, str):
                if discipline.upper().startswith("M"):
                    m_series.append(drawing)
        
        return m_series