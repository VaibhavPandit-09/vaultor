package com.vaultor.vaultor.repository;

import com.vaultor.vaultor.model.Relationship;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RelationshipRepository extends JpaRepository<Relationship, String> {
    List<Relationship> findByFromIdAndType(String fromId, String type);
    List<Relationship> findByToIdAndType(String toId, String type);
    void deleteByFromIdAndType(String fromId, String type);
}
