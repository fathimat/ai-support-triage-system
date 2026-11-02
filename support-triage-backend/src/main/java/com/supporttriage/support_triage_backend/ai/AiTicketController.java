
package com.supporttriage.support_triage_backend.ai;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "https://ai-support-triage-frontend.onrender.com"
})
public class AiTicketController {

    private final GeminiService geminiService;

    public AiTicketController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @PostMapping("/analyze")
    public ResponseEntity<?> analyzeTicket(
            @RequestBody Map<String, String> request) {

        String description = request.get("description");

        if (description == null || description.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of(
                        "error", "Ticket description is required"
                    ));
        }

        if (description.length() > 5000) {
            return ResponseEntity.badRequest()
                    .body(Map.of(
                        "error", "Description must be 5000 characters or fewer"
                    ));
        }

        try {
            
String result = geminiService.analyzeTicket(description);

JsonNode analysis = new JsonMapper().readTree(result);

return ResponseEntity.ok(Map.of("analysis", analysis));


        
} catch (Exception e) {
    System.err.println("Gemini AI analysis error: "
        + e.getClass().getSimpleName());

    return ResponseEntity.internalServerError()
        .body(Map.of("error", "AI analysis failed. Please try again."));
}

    }
}
