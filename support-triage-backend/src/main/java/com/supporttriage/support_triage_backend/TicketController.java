package com.supporttriage.support_triage_backend;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@CrossOrigin(origins = {
    "http://localhost:5173",
    "https://support-triage-frontend.onrender.com"
})
@RestController
public class TicketController {

    private final JdbcTemplate jdbcTemplate;
    private final TicketRepository ticketRepository;

    public TicketController(
            TicketRepository ticketRepository,
            JdbcTemplate jdbcTemplate) {
        this.ticketRepository = ticketRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/api/tickets")
    public List<Ticket> getTickets() {
        return ticketRepository.findAll();
    }

    @PostMapping("/api/tickets/import")
    public List<Ticket> importTickets(@RequestBody List<Ticket> tickets) {
        if (ticketRepository.count() > 0) {
            throw new RuntimeException(
                    "Import stopped: the tickets table is not empty."
            );
        }

        for (Ticket ticket : tickets) {
            if (ticket.getId() == null) {
                throw new RuntimeException(
                        "Import stopped: every ticket must have an ID."
                );
            }

            String sql = """
            INSERT INTO tickets
                (id, title, description, category, priority, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """;

            jdbcTemplate.update(
                    sql,
                    ticket.getId(),
                    ticket.getTitle(),
                    ticket.getDescription(),
                    ticket.getCategory(),
                    ticket.getPriority(),
                    ticket.getStatus()
            );
        }

        return ticketRepository.findAll();
    }

    @PostMapping("/api/tickets")
    public Ticket addTicket(@RequestBody Ticket ticket) {
        ticket.setId(null);
        return ticketRepository.save(ticket);
    }

    @PutMapping("/api/tickets/{id}")
    public Ticket updateTicket(
            @PathVariable Long id,
            @RequestBody Ticket updatedTicket) {

        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(()
                        -> new RuntimeException("Ticket not found: " + id));

        ticket.setTitle(updatedTicket.getTitle());
        ticket.setDescription(updatedTicket.getDescription());
        ticket.setCategory(updatedTicket.getCategory());
        ticket.setPriority(updatedTicket.getPriority());
        ticket.setStatus(updatedTicket.getStatus());

        return ticketRepository.save(ticket);
    }

    @DeleteMapping("/api/tickets/{id}")
    public void deleteTicket(@PathVariable Long id) {
        ticketRepository.deleteById(id);
    }
}
