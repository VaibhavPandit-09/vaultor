package com.vaultor.vaultor.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.vaultor.vaultor.model.Relationship;
import com.vaultor.vaultor.repository.RelationshipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class RelationshipService {
    private final RelationshipRepository relationshipRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void deleteRelationshipsFor(String resourceId) {
        relationshipRepository.deleteByFromIdAndType(resourceId, "link");
    }

    @Transactional
    public void updateLinksForNote(String noteId, String contentJson) {
        // Find existing links and delete them
        relationshipRepository.deleteByFromIdAndType(noteId, "link");

        if (contentJson == null || contentJson.trim().isEmpty()) return;

        Set<String> linkedResourceIds = new HashSet<>();
        try {
            JsonNode root = objectMapper.readTree(contentJson);
            extractLinks(root, linkedResourceIds);

            for (String targetId : linkedResourceIds) {
                relationshipRepository.save(new Relationship(noteId, targetId, "link"));
            }
        } catch (Exception e) {
            log.warn("Failed to parse note content for links. Might be legacy markdown.", e);
        }
    }

    private void extractLinks(JsonNode node, Set<String> links) {
        if (node.isObject()) {
            if (node.has("type") && "resourceLink".equals(node.get("type").asText())) {
                JsonNode attrs = node.get("attrs");
                if (attrs != null && attrs.has("resourceId")) {
                    links.add(attrs.get("resourceId").asText());
                }
            }
            node.properties().forEach(entry -> extractLinks(entry.getValue(), links));
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                extractLinks(child, links);
            }
        }
    }
}
